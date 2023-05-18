import { CHAIN_ID_ALGORAND, CHAIN_ID_APTOS, CHAIN_ID_INJECTIVE, CHAIN_ID_KLAYTN, CHAIN_ID_SEI, CHAIN_ID_SOLANA, CHAIN_ID_SUI, CHAIN_ID_XPLA, cosmos, createNonce, getEmitterAddressAlgorand, getEmitterAddressEth, getEmitterAddressInjective, getEmitterAddressNear, getEmitterAddressSolana, getEmitterAddressTerra, getEmitterAddressXpla, hexToUint8Array, isEVMChain, isTerraChain, parseSequenceFromLogAlgorand, parseSequenceFromLogEth, parseSequenceFromLogInjective, parseSequenceFromLogNear, parseSequenceFromLogSolana, parseSequenceFromLogTerra, parseSequenceFromLogXpla, transferFromAlgorand, transferFromEth, transferFromEthNative, transferFromInjective, transferFromSolana, transferFromSui, transferFromTerra, transferFromXpla, transferNativeSol, transferNearFromNear, transferTokenFromNear, uint8ArrayToHex, } from "@certusone/wormhole-sdk";
import { getOriginalPackageId } from "@certusone/wormhole-sdk/lib/cjs/sui";
import { CHAIN_ID_NEAR } from "@certusone/wormhole-sdk/lib/esm";
import { transferTokens } from "@certusone/wormhole-sdk/lib/esm/aptos/api/tokenBridge";
import { getEmitterAddressAndSequenceFromResponseSui } from "@certusone/wormhole-sdk/lib/esm/sui";
import { calculateFee } from "@cosmjs/stargate";
import { Alert } from "@material-ui/lab";
import { useSigningCosmWasmClient as useSeiSigningCosmWasmClient, useWallet as useSeiWallet, } from "@sei-js/react";
import { Connection } from "@solana/web3.js";
import { useWallet, } from "@suiet/wallet-kit";
import { useConnectedWallet, } from "@terra-money/wallet-provider";
import { useConnectedWallet as useXplaConnectedWallet, } from "@xpla/wallet-provider";
import algosdk from "algosdk";
import { parseUnits, zeroPad } from "ethers/lib/utils";
import { useSnackbar } from "notistack";
import { useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useAlgorandContext } from "../contexts/AlgorandWalletContext";
import { useAptosContext } from "../contexts/AptosWalletContext";
import { useEthereumProvider } from "../contexts/EthereumProviderContext";
import { useInjectiveContext } from "../contexts/InjectiveWalletContext";
import { useNearContext } from "../contexts/NearWalletContext";
import { useSolanaWallet } from "../contexts/SolanaWalletContext";
import { selectTerraFeeDenom, selectTransferAmount, selectTransferIsSendComplete, selectTransferIsSending, selectTransferIsTargetComplete, selectTransferOriginAsset, selectTransferOriginChain, selectTransferRelayerFee, selectTransferSourceAsset, selectTransferSourceChain, selectTransferSourceParsedTokenAccount, selectTransferTargetChain, } from "../store/selectors";
import { setIsSending, setIsVAAPending, setSignedVAAHex, setTransferTx, } from "../store/transferSlice";
import { signSendAndConfirmAlgorand } from "../utils/algorand";
import { getAptosClient, getEmitterAddressAndSequenceFromResult, waitForSignAndSubmitTransaction, } from "../utils/aptos";
import { ALGORAND_BRIDGE_ID, ALGORAND_HOST, ALGORAND_TOKEN_BRIDGE_ID, NATIVE_NEAR_PLACEHOLDER, NEAR_CORE_BRIDGE_ACCOUNT, NEAR_TOKEN_BRIDGE_ACCOUNT, SEI_TRANSLATER_TARGET, SEI_TRANSLATOR, SOLANA_HOST, SOL_BRIDGE_ADDRESS, SOL_TOKEN_BRIDGE_ADDRESS, getBridgeAddressForChain, getTokenBridgeAddressForChain, } from "../utils/consts";
import { getSignedVAAWithRetry } from "../utils/getSignedVAAWithRetry";
import { broadcastInjectiveTx } from "../utils/injective";
import { makeNearAccount, makeNearProvider, signAndSendTransactions, } from "../utils/near";
import parseError from "../utils/parseError";
import { parseSequenceFromLogSei } from "../utils/sei";
import { signSendAndConfirm } from "../utils/solana";
import { getSuiProvider } from "../utils/sui";
import { postWithFees, waitForTerraExecution } from "../utils/terra";
import { postWithFeesXpla, waitForXplaExecution } from "../utils/xpla";
import useTransferTargetAddressHex from "./useTransferTargetAddress";
function maybeAdditionalPayload(recipientChain, recipientAddress) {
    if (recipientChain === CHAIN_ID_SEI) {
        return {
            receivingContract: SEI_TRANSLATER_TARGET,
            payload: new Uint8Array(Buffer.from(JSON.stringify({
                basic_recipient: {
                    recipient: Buffer.from(
                    // Sei wallet addresses are 20 bytes
                    cosmos.humanAddress("sei", recipientAddress.slice(12))).toString("base64"),
                },
            }))),
        };
    }
    return null;
}
async function fetchSignedVAA(chainId, emitterAddress, sequence, enqueueSnackbar, dispatch) {
    enqueueSnackbar(null, {
        content: <Alert severity="info">Fetching VAA</Alert>,
    });
    const { vaaBytes, isPending } = await getSignedVAAWithRetry(chainId, emitterAddress, sequence);
    if (vaaBytes !== undefined) {
        dispatch(setSignedVAAHex(uint8ArrayToHex(vaaBytes)));
        dispatch(setIsVAAPending(false));
        enqueueSnackbar(null, {
            content: <Alert severity="success">Fetched Signed VAA</Alert>,
        });
    }
    else if (isPending) {
        dispatch(setIsVAAPending(isPending));
        enqueueSnackbar(null, {
            content: <Alert severity="warning">VAA is Pending</Alert>,
        });
    }
    else {
        throw new Error("Error retrieving VAA info");
    }
}
function handleError(e, enqueueSnackbar, dispatch) {
    console.error(e);
    enqueueSnackbar(null, {
        content: <Alert severity="error">{parseError(e)}</Alert>,
    });
    dispatch(setIsSending(false));
    dispatch(setIsVAAPending(false));
}
async function algo(dispatch, enqueueSnackbar, senderAddr, tokenAddress, decimals, amount, recipientChain, recipientAddress, chainId, relayerFee) {
    dispatch(setIsSending(true));
    try {
        const baseAmountParsed = parseUnits(amount, decimals);
        const feeParsed = parseUnits(relayerFee || "0", decimals);
        const transferAmountParsed = baseAmountParsed.add(feeParsed);
        const additionalPayload = maybeAdditionalPayload(recipientChain, recipientAddress);
        const algodClient = new algosdk.Algodv2(ALGORAND_HOST.algodToken, ALGORAND_HOST.algodServer, ALGORAND_HOST.algodPort);
        const txs = await transferFromAlgorand(algodClient, ALGORAND_TOKEN_BRIDGE_ID, ALGORAND_BRIDGE_ID, senderAddr, BigInt(tokenAddress), transferAmountParsed.toBigInt(), uint8ArrayToHex(additionalPayload?.receivingContract || recipientAddress), recipientChain, feeParsed.toBigInt(), additionalPayload?.payload);
        const result = await signSendAndConfirmAlgorand(algodClient, txs);
        const sequence = parseSequenceFromLogAlgorand(result);
        dispatch(setTransferTx({
            id: txs[txs.length - 1].tx.txID(),
            block: result["confirmed-round"],
        }));
        enqueueSnackbar(null, {
            content: <Alert severity="success">Transaction confirmed</Alert>,
        });
        const emitterAddress = getEmitterAddressAlgorand(ALGORAND_TOKEN_BRIDGE_ID);
        await fetchSignedVAA(chainId, emitterAddress, sequence, enqueueSnackbar, dispatch);
    }
    catch (e) {
        handleError(e, enqueueSnackbar, dispatch);
    }
}
async function aptos(dispatch, enqueueSnackbar, tokenAddress, decimals, amount, recipientChain, recipientAddress, chainId, signAndSubmitTransaction, relayerFee) {
    dispatch(setIsSending(true));
    const tokenBridgeAddress = getTokenBridgeAddressForChain(CHAIN_ID_APTOS);
    try {
        const baseAmountParsed = parseUnits(amount, decimals);
        const feeParsed = parseUnits(relayerFee || "0", decimals);
        const transferAmountParsed = baseAmountParsed.add(feeParsed);
        const additionalPayload = maybeAdditionalPayload(recipientChain, recipientAddress);
        if (additionalPayload?.payload) {
            throw new Error("Transfer with payload is unsupported on Aptos");
        }
        const transferPayload = transferTokens(tokenBridgeAddress, tokenAddress, transferAmountParsed.toString(), recipientChain, recipientAddress, feeParsed.toString(), createNonce().readUInt32LE(0));
        const hash = await waitForSignAndSubmitTransaction(transferPayload, signAndSubmitTransaction);
        dispatch(setTransferTx({ id: hash, block: 1 }));
        enqueueSnackbar(null, {
            content: <Alert severity="success">Transaction confirmed</Alert>,
        });
        const result = (await getAptosClient().waitForTransactionWithResult(hash));
        const { emitterAddress, sequence } = getEmitterAddressAndSequenceFromResult(result);
        await fetchSignedVAA(chainId, emitterAddress, sequence, enqueueSnackbar, dispatch);
    }
    catch (e) {
        enqueueSnackbar(null, {
            content: <Alert severity="error">{parseError(e)}</Alert>,
        });
        dispatch(setIsSending(false));
    }
}
async function evm(dispatch, enqueueSnackbar, signer, tokenAddress, decimals, amount, recipientChain, recipientAddress, isNative, chainId, relayerFee) {
    dispatch(setIsSending(true));
    try {
        const baseAmountParsed = parseUnits(amount, decimals);
        const feeParsed = parseUnits(relayerFee || "0", decimals);
        const transferAmountParsed = baseAmountParsed.add(feeParsed);
        const additionalPayload = maybeAdditionalPayload(recipientChain, recipientAddress);
        // Klaytn requires specifying gasPrice
        const overrides = chainId === CHAIN_ID_KLAYTN
            ? { gasPrice: (await signer.getGasPrice()).toString() }
            : {};
        const receipt = isNative
            ? await transferFromEthNative(getTokenBridgeAddressForChain(chainId), signer, transferAmountParsed, recipientChain, additionalPayload?.receivingContract || recipientAddress, feeParsed, overrides, additionalPayload?.payload)
            : await transferFromEth(getTokenBridgeAddressForChain(chainId), signer, tokenAddress, transferAmountParsed, recipientChain, additionalPayload?.receivingContract || recipientAddress, feeParsed, overrides, additionalPayload?.payload);
        dispatch(setTransferTx({ id: receipt.transactionHash, block: receipt.blockNumber }));
        enqueueSnackbar(null, {
            content: <Alert severity="success">Transaction confirmed</Alert>,
        });
        const sequence = parseSequenceFromLogEth(receipt, getBridgeAddressForChain(chainId));
        const emitterAddress = getEmitterAddressEth(getTokenBridgeAddressForChain(chainId));
        await fetchSignedVAA(chainId, emitterAddress, sequence, enqueueSnackbar, dispatch);
    }
    catch (e) {
        handleError(e, enqueueSnackbar, dispatch);
    }
}
async function near(dispatch, enqueueSnackbar, wallet, senderAddr, tokenAddress, decimals, amount, recipientChain, recipientAddress, chainId, relayerFee) {
    dispatch(setIsSending(true));
    try {
        const baseAmountParsed = parseUnits(amount, decimals);
        const feeParsed = parseUnits(relayerFee || "0", decimals);
        const transferAmountParsed = baseAmountParsed.add(feeParsed);
        const additionalPayload = maybeAdditionalPayload(recipientChain, recipientAddress);
        const account = await makeNearAccount(senderAddr);
        const msgs = tokenAddress === NATIVE_NEAR_PLACEHOLDER
            ? [
                await transferNearFromNear(makeNearProvider(), NEAR_CORE_BRIDGE_ACCOUNT, NEAR_TOKEN_BRIDGE_ACCOUNT, transferAmountParsed.toBigInt(), additionalPayload?.receivingContract || recipientAddress, recipientChain, feeParsed.toBigInt(), additionalPayload?.payload
                    ? uint8ArrayToHex(additionalPayload.payload)
                    : undefined),
            ]
            : await transferTokenFromNear(makeNearProvider(), account.accountId, NEAR_CORE_BRIDGE_ACCOUNT, NEAR_TOKEN_BRIDGE_ACCOUNT, tokenAddress, transferAmountParsed.toBigInt(), additionalPayload?.receivingContract || recipientAddress, recipientChain, feeParsed.toBigInt(), additionalPayload?.payload
                ? uint8ArrayToHex(additionalPayload.payload)
                : undefined);
        const receipt = await signAndSendTransactions(account, wallet, msgs);
        const sequence = parseSequenceFromLogNear(receipt);
        dispatch(setTransferTx({
            id: receipt.transaction_outcome.id,
            block: 0,
        }));
        if (sequence === null) {
            throw new Error("Unable to parse sequence from log");
        }
        enqueueSnackbar(null, {
            content: <Alert severity="success">Transaction confirmed</Alert>,
        });
        const emitterAddress = getEmitterAddressNear(NEAR_TOKEN_BRIDGE_ACCOUNT);
        await fetchSignedVAA(chainId, emitterAddress, sequence, enqueueSnackbar, dispatch);
    }
    catch (e) {
        handleError(e, enqueueSnackbar, dispatch);
    }
}
async function solana(dispatch, enqueueSnackbar, wallet, payerAddress, //TODO: we may not need this since we have wallet
fromAddress, mintAddress, amount, decimals, targetChain, targetAddress, isNative, originAddressStr, originChain, relayerFee) {
    dispatch(setIsSending(true));
    try {
        const connection = new Connection(SOLANA_HOST, "confirmed");
        const baseAmountParsed = parseUnits(amount, decimals);
        const feeParsed = parseUnits(relayerFee || "0", decimals);
        const transferAmountParsed = baseAmountParsed.add(feeParsed);
        const additionalPayload = maybeAdditionalPayload(targetChain, targetAddress);
        const originAddress = originAddressStr
            ? zeroPad(hexToUint8Array(originAddressStr), 32)
            : undefined;
        const promise = isNative
            ? transferNativeSol(connection, SOL_BRIDGE_ADDRESS, SOL_TOKEN_BRIDGE_ADDRESS, payerAddress, transferAmountParsed.toBigInt(), additionalPayload?.receivingContract || targetAddress, targetChain, feeParsed.toBigInt(), additionalPayload?.payload)
            : transferFromSolana(connection, SOL_BRIDGE_ADDRESS, SOL_TOKEN_BRIDGE_ADDRESS, payerAddress, fromAddress, mintAddress, transferAmountParsed.toBigInt(), additionalPayload?.receivingContract || targetAddress, targetChain, originAddress, originChain, undefined, feeParsed.toBigInt(), additionalPayload?.payload);
        const transaction = await promise;
        const txid = await signSendAndConfirm(wallet, connection, transaction);
        enqueueSnackbar(null, {
            content: <Alert severity="success">Transaction confirmed</Alert>,
        });
        const info = await connection.getTransaction(txid);
        if (!info) {
            throw new Error("An error occurred while fetching the transaction info");
        }
        dispatch(setTransferTx({ id: txid, block: info.slot }));
        const sequence = parseSequenceFromLogSolana(info);
        const emitterAddress = await getEmitterAddressSolana(SOL_TOKEN_BRIDGE_ADDRESS);
        await fetchSignedVAA(CHAIN_ID_SOLANA, emitterAddress, sequence, enqueueSnackbar, dispatch);
    }
    catch (e) {
        handleError(e, enqueueSnackbar, dispatch);
    }
}
async function terra(dispatch, enqueueSnackbar, wallet, asset, amount, decimals, targetChain, targetAddress, feeDenom, chainId, relayerFee) {
    dispatch(setIsSending(true));
    try {
        const baseAmountParsed = parseUnits(amount, decimals);
        const feeParsed = parseUnits(relayerFee || "0", decimals);
        const transferAmountParsed = baseAmountParsed.add(feeParsed);
        const tokenBridgeAddress = getTokenBridgeAddressForChain(chainId);
        const additionalPayload = maybeAdditionalPayload(targetChain, targetAddress);
        const msgs = await transferFromTerra(wallet.terraAddress, tokenBridgeAddress, asset, transferAmountParsed.toString(), targetChain, additionalPayload?.receivingContract || targetAddress, feeParsed.toString(), additionalPayload?.payload);
        const result = await postWithFees(wallet, msgs, "Wormhole - Initiate Transfer", [feeDenom], chainId);
        const info = await waitForTerraExecution(result, chainId);
        dispatch(setTransferTx({ id: info.txhash, block: info.height }));
        enqueueSnackbar(null, {
            content: <Alert severity="success">Transaction confirmed</Alert>,
        });
        const sequence = parseSequenceFromLogTerra(info);
        if (!sequence) {
            throw new Error("Sequence not found");
        }
        const emitterAddress = await getEmitterAddressTerra(tokenBridgeAddress);
        await fetchSignedVAA(chainId, emitterAddress, sequence, enqueueSnackbar, dispatch);
    }
    catch (e) {
        handleError(e, enqueueSnackbar, dispatch);
    }
}
async function xpla(dispatch, enqueueSnackbar, wallet, asset, amount, decimals, targetChain, targetAddress, relayerFee) {
    dispatch(setIsSending(true));
    try {
        const baseAmountParsed = parseUnits(amount, decimals);
        const feeParsed = parseUnits(relayerFee || "0", decimals);
        const transferAmountParsed = baseAmountParsed.add(feeParsed);
        const tokenBridgeAddress = getTokenBridgeAddressForChain(CHAIN_ID_XPLA);
        const additionalPayload = maybeAdditionalPayload(targetChain, targetAddress);
        const msgs = await transferFromXpla(wallet.xplaAddress, tokenBridgeAddress, asset, transferAmountParsed.toString(), targetChain, additionalPayload?.receivingContract || targetAddress, feeParsed.toString(), additionalPayload?.payload);
        const result = await postWithFeesXpla(wallet, msgs, "Wormhole - Initiate Transfer");
        const info = await waitForXplaExecution(result);
        dispatch(setTransferTx({ id: info.txhash, block: info.height }));
        enqueueSnackbar(null, {
            content: <Alert severity="success">Transaction confirmed</Alert>,
        });
        const sequence = parseSequenceFromLogXpla(info);
        if (!sequence) {
            throw new Error("Sequence not found");
        }
        const emitterAddress = await getEmitterAddressXpla(tokenBridgeAddress);
        await fetchSignedVAA(CHAIN_ID_XPLA, emitterAddress, sequence, enqueueSnackbar, dispatch);
    }
    catch (e) {
        handleError(e, enqueueSnackbar, dispatch);
    }
}
async function injective(dispatch, enqueueSnackbar, wallet, walletAddress, asset, amount, decimals, targetChain, targetAddress, relayerFee) {
    dispatch(setIsSending(true));
    try {
        const baseAmountParsed = parseUnits(amount, decimals);
        const feeParsed = parseUnits(relayerFee || "0", decimals);
        const transferAmountParsed = baseAmountParsed.add(feeParsed);
        const tokenBridgeAddress = getTokenBridgeAddressForChain(CHAIN_ID_INJECTIVE);
        const additionalPayload = maybeAdditionalPayload(targetChain, targetAddress);
        const msgs = await transferFromInjective(walletAddress, tokenBridgeAddress, asset, transferAmountParsed.toString(), targetChain, additionalPayload?.receivingContract || targetAddress, feeParsed.toString(), additionalPayload?.payload);
        const tx = await broadcastInjectiveTx(wallet, walletAddress, msgs, "Wormhole - Initiate Transfer");
        dispatch(setTransferTx({ id: tx.txHash, block: tx.height }));
        enqueueSnackbar(null, {
            content: <Alert severity="success">Transaction confirmed</Alert>,
        });
        const sequence = parseSequenceFromLogInjective(tx);
        if (!sequence) {
            throw new Error("Sequence not found");
        }
        const emitterAddress = await getEmitterAddressInjective(tokenBridgeAddress);
        await fetchSignedVAA(CHAIN_ID_INJECTIVE, emitterAddress, sequence, enqueueSnackbar, dispatch);
    }
    catch (e) {
        handleError(e, enqueueSnackbar, dispatch);
    }
}
async function sei(dispatch, enqueueSnackbar, wallet, walletAddress, asset, amount, decimals, targetChain, targetAddress, relayerFee) {
    dispatch(setIsSending(true));
    try {
        const baseAmountParsed = parseUnits(amount, decimals);
        const feeParsed = parseUnits(relayerFee || "0", decimals);
        const transferAmountParsed = baseAmountParsed.add(feeParsed);
        const tokenBridgeAddress = getTokenBridgeAddressForChain(CHAIN_ID_SEI);
        // NOTE: this only supports transferring out via the Sei CW20 <> Bank translator
        const msg = {
            convert_and_transfer: {
                recipient_chain: targetChain,
                recipient: Buffer.from(targetAddress).toString("base64"),
                fee: feeParsed.toString(),
            },
        };
        const fee = calculateFee(600000, "0.1usei");
        const tx = await wallet.execute(walletAddress, SEI_TRANSLATOR, msg, fee, "Wormhole - Initiate Transfer", [{ denom: asset, amount: transferAmountParsed.toString() }]);
        dispatch(setTransferTx({ id: tx.transactionHash, block: tx.height }));
        enqueueSnackbar(null, {
            content: <Alert severity="success">Transaction confirmed</Alert>,
        });
        const sequence = parseSequenceFromLogSei(tx);
        if (!sequence) {
            throw new Error("Sequence not found");
        }
        const emitterAddress = await getEmitterAddressTerra(tokenBridgeAddress);
        console.log("Sei VAA", CHAIN_ID_SEI, emitterAddress, sequence);
        await fetchSignedVAA(CHAIN_ID_SEI, emitterAddress, sequence, enqueueSnackbar, dispatch);
    }
    catch (e) {
        handleError(e, enqueueSnackbar, dispatch);
    }
}
async function sui(dispatch, enqueueSnackbar, wallet, asset, amount, decimals, targetChain, targetAddress, relayerFee) {
    dispatch(setIsSending(true));
    try {
        if (!wallet.address) {
            throw new Error("No wallet address");
        }
        const baseAmountParsed = parseUnits(amount, decimals);
        const feeParsed = parseUnits(relayerFee || "0", decimals);
        const transferAmountParsed = baseAmountParsed.add(feeParsed);
        const provider = getSuiProvider();
        // TODO: handle pagination
        const coins = (await provider.getCoins({
            owner: wallet.address,
            coinType: asset,
        })).data;
        const tx = await transferFromSui(provider, getBridgeAddressForChain(CHAIN_ID_SUI), getTokenBridgeAddressForChain(CHAIN_ID_SUI), coins, asset, transferAmountParsed.toBigInt(), targetChain, targetAddress);
        const response = await wallet.signAndExecuteTransactionBlock({
            transactionBlock: tx,
            options: {
                showEvents: true,
            },
        });
        dispatch(setTransferTx({
            id: response.digest,
            block: Number(response.checkpoint || 0),
        }));
        enqueueSnackbar(null, {
            content: <Alert severity="success">Transaction confirmed</Alert>,
        });
        const coreBridgePackageId = await getOriginalPackageId(provider, getBridgeAddressForChain(CHAIN_ID_SUI));
        if (!coreBridgePackageId)
            throw new Error("Unable to retrieve original package id");
        const { sequence, emitterAddress } = getEmitterAddressAndSequenceFromResponseSui(coreBridgePackageId, response);
        console.log(emitterAddress, sequence);
        await fetchSignedVAA(CHAIN_ID_SUI, emitterAddress, sequence, enqueueSnackbar, dispatch);
    }
    catch (e) {
        handleError(e, enqueueSnackbar, dispatch);
    }
}
export function useHandleTransfer() {
    const dispatch = useDispatch();
    const { enqueueSnackbar } = useSnackbar();
    const sourceChain = useSelector(selectTransferSourceChain);
    const sourceAsset = useSelector(selectTransferSourceAsset);
    const originChain = useSelector(selectTransferOriginChain);
    const originAsset = useSelector(selectTransferOriginAsset);
    const amount = useSelector(selectTransferAmount);
    const targetChain = useSelector(selectTransferTargetChain);
    const targetAddress = useTransferTargetAddressHex();
    const isTargetComplete = useSelector(selectTransferIsTargetComplete);
    const isSending = useSelector(selectTransferIsSending);
    const isSendComplete = useSelector(selectTransferIsSendComplete);
    const { signer } = useEthereumProvider();
    const solanaWallet = useSolanaWallet();
    const solPK = solanaWallet?.publicKey;
    const terraWallet = useConnectedWallet();
    const terraFeeDenom = useSelector(selectTerraFeeDenom);
    const xplaWallet = useXplaConnectedWallet();
    const { accounts: algoAccounts } = useAlgorandContext();
    const { account: aptosAccount, signAndSubmitTransaction } = useAptosContext();
    const aptosAddress = aptosAccount?.address?.toString();
    const { wallet: injWallet, address: injAddress } = useInjectiveContext();
    const { signingCosmWasmClient: seiSigningCosmWasmClient } = useSeiSigningCosmWasmClient();
    const { accounts: seiAccounts } = useSeiWallet();
    const seiAddress = seiAccounts.length ? seiAccounts[0].address : null;
    const { accountId: nearAccountId, wallet: nearWallet } = useNearContext();
    const suiWallet = useWallet();
    const sourceParsedTokenAccount = useSelector(selectTransferSourceParsedTokenAccount);
    const relayerFee = useSelector(selectTransferRelayerFee);
    const sourceTokenPublicKey = sourceParsedTokenAccount?.publicKey;
    const decimals = sourceParsedTokenAccount?.decimals;
    const isNative = sourceParsedTokenAccount?.isNativeAsset || false;
    const disabled = !isTargetComplete || isSending || isSendComplete;
    const handleTransferClick = useCallback(() => {
        // TODO: we should separate state for transaction vs fetching vaa
        if (isEVMChain(sourceChain) &&
            !!signer &&
            !!sourceAsset &&
            decimals !== undefined &&
            !!targetAddress) {
            evm(dispatch, enqueueSnackbar, signer, sourceAsset, decimals, amount, targetChain, targetAddress, isNative, sourceChain, relayerFee);
        }
        else if (sourceChain === CHAIN_ID_SOLANA &&
            !!solanaWallet &&
            !!solPK &&
            !!sourceAsset &&
            !!sourceTokenPublicKey &&
            !!targetAddress &&
            decimals !== undefined) {
            solana(dispatch, enqueueSnackbar, solanaWallet, solPK.toString(), sourceTokenPublicKey, sourceAsset, amount, decimals, targetChain, targetAddress, isNative, originAsset, originChain, relayerFee);
        }
        else if (isTerraChain(sourceChain) &&
            !!terraWallet &&
            !!sourceAsset &&
            decimals !== undefined &&
            !!targetAddress) {
            terra(dispatch, enqueueSnackbar, terraWallet, sourceAsset, amount, decimals, targetChain, targetAddress, terraFeeDenom, sourceChain, relayerFee);
        }
        else if (sourceChain === CHAIN_ID_XPLA &&
            !!xplaWallet &&
            !!sourceAsset &&
            decimals !== undefined &&
            !!targetAddress) {
            xpla(dispatch, enqueueSnackbar, xplaWallet, sourceAsset, amount, decimals, targetChain, targetAddress, relayerFee);
        }
        else if (sourceChain === CHAIN_ID_ALGORAND &&
            algoAccounts[0] &&
            !!sourceAsset &&
            decimals !== undefined &&
            !!targetAddress) {
            algo(dispatch, enqueueSnackbar, algoAccounts[0].address, sourceAsset, decimals, amount, targetChain, targetAddress, sourceChain, relayerFee);
        }
        else if (sourceChain === CHAIN_ID_APTOS &&
            aptosAddress &&
            !!sourceAsset &&
            decimals !== undefined &&
            !!targetAddress) {
            aptos(dispatch, enqueueSnackbar, sourceAsset, decimals, amount, targetChain, targetAddress, sourceChain, signAndSubmitTransaction, relayerFee);
        }
        else if (sourceChain === CHAIN_ID_INJECTIVE &&
            injWallet &&
            injAddress &&
            !!sourceAsset &&
            decimals !== undefined &&
            !!targetAddress) {
            injective(dispatch, enqueueSnackbar, injWallet, injAddress, sourceAsset, amount, decimals, targetChain, targetAddress, relayerFee);
        }
        else if (sourceChain === CHAIN_ID_SEI &&
            seiSigningCosmWasmClient &&
            seiAddress &&
            !!sourceAsset &&
            decimals !== undefined &&
            !!targetAddress) {
            sei(dispatch, enqueueSnackbar, seiSigningCosmWasmClient, seiAddress, sourceAsset, amount, decimals, targetChain, targetAddress, relayerFee);
        }
        else if (sourceChain === CHAIN_ID_NEAR &&
            nearAccountId &&
            nearWallet &&
            !!sourceAsset &&
            decimals !== undefined &&
            !!targetAddress) {
            near(dispatch, enqueueSnackbar, nearWallet, nearAccountId, sourceAsset, decimals, amount, targetChain, targetAddress, sourceChain, relayerFee);
        }
        else if (sourceChain === CHAIN_ID_SUI &&
            suiWallet.connected &&
            suiWallet.address &&
            !!sourceAsset &&
            decimals !== undefined &&
            !!targetAddress) {
            sui(dispatch, enqueueSnackbar, suiWallet, sourceAsset, amount, decimals, targetChain, targetAddress, relayerFee);
        }
    }, [
        dispatch,
        enqueueSnackbar,
        sourceChain,
        signer,
        relayerFee,
        solanaWallet,
        solPK,
        terraWallet,
        sourceTokenPublicKey,
        sourceAsset,
        amount,
        decimals,
        targetChain,
        targetAddress,
        originAsset,
        originChain,
        isNative,
        terraFeeDenom,
        algoAccounts,
        xplaWallet,
        aptosAddress,
        signAndSubmitTransaction,
        injWallet,
        injAddress,
        nearAccountId,
        seiSigningCosmWasmClient,
        seiAddress,
        nearWallet,
        suiWallet,
    ]);
    return useMemo(() => ({
        handleClick: handleTransferClick,
        disabled,
        showLoader: isSending,
    }), [handleTransferClick, disabled, isSending]);
}
