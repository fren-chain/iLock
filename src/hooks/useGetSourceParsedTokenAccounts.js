import { CHAIN_ID_ACALA, CHAIN_ID_ALGORAND, CHAIN_ID_APTOS, CHAIN_ID_AURORA, CHAIN_ID_AVAX, CHAIN_ID_BSC, CHAIN_ID_CELO, CHAIN_ID_ETH, CHAIN_ID_FANTOM, CHAIN_ID_INJECTIVE, CHAIN_ID_KARURA, CHAIN_ID_KLAYTN, CHAIN_ID_MOONBEAM, CHAIN_ID_NEAR, CHAIN_ID_NEON, CHAIN_ID_OASIS, CHAIN_ID_POLYGON, CHAIN_ID_SEPOLIA, CHAIN_ID_SOLANA, CHAIN_ID_XPLA, ethers_contracts, isEVMChain, isTerraChain, WSOL_ADDRESS, WSOL_DECIMALS, CHAIN_ID_SEI, CHAIN_ID_SUI, } from "@certusone/wormhole-sdk";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Connection, PublicKey, } from "@solana/web3.js";
import { Algodv2 } from "algosdk";
import axios from "axios";
import { ethers } from "ethers";
import { formatUnits } from "ethers/lib/utils";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useAlgorandContext } from "../contexts/AlgorandWalletContext";
import { useEthereumProvider, } from "../contexts/EthereumProviderContext";
import { useNearContext } from "../contexts/NearWalletContext";
import { useSolanaWallet } from "../contexts/SolanaWalletContext";
import acalaIcon from "../icons/acala.svg";
import auroraIcon from "../icons/aurora.svg";
import avaxIcon from "../icons/avax.svg";
import bnbIcon from "../icons/bnb.svg";
import celoIcon from "../icons/celo.svg";
import ethIcon from "../icons/eth.svg";
import fantomIcon from "../icons/fantom.svg";
import karuraIcon from "../icons/karura.svg";
import klaytnIcon from "../icons/klaytn.svg";
import neonIcon from "../icons/neon.svg";
import oasisIcon from "../icons/oasis-network-rose-logo.svg";
import polygonIcon from "../icons/polygon.svg";
import moonbeamIcon from "../icons/moonbeam.svg";
import suiIcon from "../icons/sui.svg";
import { errorSourceParsedTokenAccounts as errorSourceParsedTokenAccountsNFT, fetchSourceParsedTokenAccounts as fetchSourceParsedTokenAccountsNFT, receiveSourceParsedTokenAccounts as receiveSourceParsedTokenAccountsNFT, setSourceParsedTokenAccount as setSourceParsedTokenAccountNFT, setSourceParsedTokenAccounts as setSourceParsedTokenAccountsNFT, setSourceWalletAddress as setSourceWalletAddressNFT, } from "../store/nftSlice";
import { selectNFTSourceChain, selectNFTSourceParsedTokenAccounts, selectNFTSourceWalletAddress, selectSourceWalletAddress, selectTransferSourceChain, selectTransferSourceParsedTokenAccounts, } from "../store/selectors";
import { errorSourceParsedTokenAccounts, fetchSourceParsedTokenAccounts, receiveSourceParsedTokenAccounts, setAmount, setSourceParsedTokenAccount, setSourceParsedTokenAccounts, setSourceWalletAddress, } from "../store/transferSlice";
import { ACA_ADDRESS, ACA_DECIMALS, ALGORAND_HOST, ALGO_DECIMALS, COVALENT_GET_TOKENS_URL, BLOCKSCOUT_GET_TOKENS_URL, KAR_ADDRESS, KAR_DECIMALS, NATIVE_NEAR_DECIMALS, NATIVE_NEAR_PLACEHOLDER, SOLANA_HOST, WAVAX_ADDRESS, WAVAX_DECIMALS, WBNB_ADDRESS, WBNB_DECIMALS, CELO_ADDRESS, CELO_DECIMALS, WETH_ADDRESS, WETH_AURORA_ADDRESS, WETH_AURORA_DECIMALS, WETH_DECIMALS, WFTM_ADDRESS, WFTM_DECIMALS, WKLAY_ADDRESS, WKLAY_DECIMALS, WMATIC_ADDRESS, WMATIC_DECIMALS, WNEON_ADDRESS, WNEON_DECIMALS, WROSE_ADDRESS, WROSE_DECIMALS, getDefaultNativeCurrencyAddressEvm, WGLMR_ADDRESS, WGLMR_DECIMALS, WETH_ADDRESS_SEPOLIA, WETH_DECIMALS_SEPOLIA, SUI_NATIVE_TOKEN_KEY, } from "../utils/consts";
import { makeNearAccount } from "../utils/near";
import { extractMintInfo, getMultipleAccountsRPC, } from "../utils/solana";
import { fetchSingleMetadata } from "./useAlgoMetadata";
import { getSuiProvider } from "../utils/sui";
import { useWallet } from "@suiet/wallet-kit";
export function createParsedTokenAccount(publicKey, mintKey, amount, decimals, uiAmount, uiAmountString, symbol, name, logo, isNativeAsset) {
    return {
        publicKey: publicKey,
        mintKey: mintKey,
        amount,
        decimals,
        uiAmount,
        uiAmountString,
        symbol,
        name,
        logo,
        isNativeAsset,
    };
}
export function createNFTParsedTokenAccount(publicKey, mintKey, amount, decimals, uiAmount, uiAmountString, tokenId, symbol, name, uri, animation_url, external_url, image, image_256, nftName, description) {
    return {
        publicKey,
        mintKey,
        amount,
        decimals,
        uiAmount,
        uiAmountString,
        tokenId,
        uri,
        animation_url,
        external_url,
        image,
        image_256,
        symbol,
        name,
        nftName,
        description,
    };
}
const createParsedTokenAccountFromInfo = (pubkey, item) => {
    return {
        publicKey: pubkey?.toString(),
        mintKey: item.data.parsed?.info?.mint?.toString(),
        amount: item.data.parsed?.info?.tokenAmount?.amount,
        decimals: item.data.parsed?.info?.tokenAmount?.decimals,
        uiAmount: item.data.parsed?.info?.tokenAmount?.uiAmount,
        uiAmountString: item.data.parsed?.info?.tokenAmount?.uiAmountString,
    };
};
const createParsedTokenAccountFromCovalent = (walletAddress, covalent) => {
    return {
        publicKey: walletAddress,
        mintKey: covalent.contract_address,
        amount: covalent.balance,
        decimals: covalent.contract_decimals,
        uiAmount: Number(formatUnits(covalent.balance, covalent.contract_decimals)),
        uiAmountString: formatUnits(covalent.balance, covalent.contract_decimals),
        symbol: covalent.contract_ticker_symbol,
        name: covalent.contract_name,
        logo: covalent.logo_url,
    };
};
const createNativeSolParsedTokenAccount = async (connection, walletAddress) => {
    // const walletAddress = "H69q3Q8E74xm7swmMQpsJLVp2Q9JuBwBbxraAMX5Drzm" // known solana mainnet wallet with tokens
    const fetchAccounts = await getMultipleAccountsRPC(connection, [
        new PublicKey(walletAddress),
    ]);
    if (!fetchAccounts || !fetchAccounts.length || !fetchAccounts[0]) {
        return null;
    }
    else {
        return createParsedTokenAccount(walletAddress, //publicKey
        WSOL_ADDRESS, //Mint key
        fetchAccounts[0].lamports.toString(), //amount
        WSOL_DECIMALS, //decimals, 9
        parseFloat(formatUnits(fetchAccounts[0].lamports, WSOL_DECIMALS)), formatUnits(fetchAccounts[0].lamports, WSOL_DECIMALS).toString(), "SOL", "Solana", undefined, //TODO logo. It's in the solana token map, so we could potentially use that URL.
        true);
    }
};
const createNativeEthParsedTokenAccount = (provider, signerAddress) => {
    return !(provider && signerAddress)
        ? Promise.reject()
        : provider.getBalance(signerAddress).then((balanceInWei) => {
            const balanceInEth = ethers.utils.formatEther(balanceInWei);
            return createParsedTokenAccount(signerAddress, //public key
            WETH_ADDRESS, //Mint key, On the other side this will be WETH, so this is hopefully a white lie.
            balanceInWei.toString(), //amount, in wei
            WETH_DECIMALS, //Luckily both ETH and WETH have 18 decimals, so this should not be an issue.
            parseFloat(balanceInEth), //This loses precision, but is a limitation of the current datamodel. This field is essentially deprecated
            balanceInEth.toString(), //This is the actual display field, which has full precision.
            "ETH", //A white lie for display purposes
            "Ethereum", //A white lie for display purposes
            ethIcon, true //isNativeAsset
            );
        });
};
const createNativeSepoliaParsedTokenAccount = (provider, signerAddress) => {
    return !(provider && signerAddress)
        ? Promise.reject()
        : provider.getBalance(signerAddress).then((balanceInWei) => {
            const balanceInEth = ethers.utils.formatEther(balanceInWei);
            return createParsedTokenAccount(signerAddress, //public key
            WETH_ADDRESS_SEPOLIA, //Mint key, On the other side this will be WETH, so this is hopefully a white lie.
            balanceInWei.toString(), //amount, in wei
            WETH_DECIMALS_SEPOLIA, //Luckily both ETH and WETH have 18 decimals, so this should not be an issue.
            parseFloat(balanceInEth), //This loses precision, but is a limitation of the current datamodel. This field is essentially deprecated
            balanceInEth.toString(), //This is the actual display field, which has full precision.
            "ETH", //A white lie for display purposes
            "Ethereum", //A white lie for display purposes
            ethIcon, true //isNativeAsset
            );
        });
};
const createNativeBscParsedTokenAccount = (provider, signerAddress) => {
    return !(provider && signerAddress)
        ? Promise.reject()
        : provider.getBalance(signerAddress).then((balanceInWei) => {
            const balanceInEth = ethers.utils.formatEther(balanceInWei);
            return createParsedTokenAccount(signerAddress, //public key
            WBNB_ADDRESS, //Mint key, On the other side this will be WBNB, so this is hopefully a white lie.
            balanceInWei.toString(), //amount, in wei
            WBNB_DECIMALS, //Luckily both BNB and WBNB have 18 decimals, so this should not be an issue.
            parseFloat(balanceInEth), //This loses precision, but is a limitation of the current datamodel. This field is essentially deprecated
            balanceInEth.toString(), //This is the actual display field, which has full precision.
            "BNB", //A white lie for display purposes
            "Binance Coin", //A white lie for display purposes
            bnbIcon, true //isNativeAsset
            );
        });
};
const createNativePolygonParsedTokenAccount = (provider, signerAddress) => {
    return !(provider && signerAddress)
        ? Promise.reject()
        : provider.getBalance(signerAddress).then((balanceInWei) => {
            const balanceInEth = ethers.utils.formatEther(balanceInWei);
            return createParsedTokenAccount(signerAddress, //public key
            WMATIC_ADDRESS, //Mint key, On the other side this will be WMATIC, so this is hopefully a white lie.
            balanceInWei.toString(), //amount, in wei
            WMATIC_DECIMALS, //Luckily both MATIC and WMATIC have 18 decimals, so this should not be an issue.
            parseFloat(balanceInEth), //This loses precision, but is a limitation of the current datamodel. This field is essentially deprecated
            balanceInEth.toString(), //This is the actual display field, which has full precision.
            "MATIC", //A white lie for display purposes
            "Matic", //A white lie for display purposes
            polygonIcon, true //isNativeAsset
            );
        });
};
const createNativeAvaxParsedTokenAccount = (provider, signerAddress) => {
    return !(provider && signerAddress)
        ? Promise.reject()
        : provider.getBalance(signerAddress).then((balanceInWei) => {
            const balanceInEth = ethers.utils.formatEther(balanceInWei);
            return createParsedTokenAccount(signerAddress, //public key
            WAVAX_ADDRESS, //Mint key, On the other side this will be wavax, so this is hopefully a white lie.
            balanceInWei.toString(), //amount, in wei
            WAVAX_DECIMALS, parseFloat(balanceInEth), //This loses precision, but is a limitation of the current datamodel. This field is essentially deprecated
            balanceInEth.toString(), //This is the actual display field, which has full precision.
            "AVAX", //A white lie for display purposes
            "Avalanche", //A white lie for display purposes
            avaxIcon, true //isNativeAsset
            );
        });
};
const createNativeOasisParsedTokenAccount = (provider, signerAddress) => {
    return !(provider && signerAddress)
        ? Promise.reject()
        : provider.getBalance(signerAddress).then((balanceInWei) => {
            const balanceInEth = ethers.utils.formatEther(balanceInWei);
            return createParsedTokenAccount(signerAddress, //public key
            WROSE_ADDRESS, //Mint key, On the other side this will be wavax, so this is hopefully a white lie.
            balanceInWei.toString(), //amount, in wei
            WROSE_DECIMALS, parseFloat(balanceInEth), //This loses precision, but is a limitation of the current datamodel. This field is essentially deprecated
            balanceInEth.toString(), //This is the actual display field, which has full precision.
            "ROSE", //A white lie for display purposes
            "Rose", //A white lie for display purposes
            oasisIcon, true //isNativeAsset
            );
        });
};
const createNativeAuroraParsedTokenAccount = (provider, signerAddress) => {
    return !(provider && signerAddress)
        ? Promise.reject()
        : provider.getBalance(signerAddress).then((balanceInWei) => {
            const balanceInEth = ethers.utils.formatEther(balanceInWei);
            return createParsedTokenAccount(signerAddress, //public key
            WETH_AURORA_ADDRESS, //Mint key, On the other side this will be wavax, so this is hopefully a white lie.
            balanceInWei.toString(), //amount, in wei
            WETH_AURORA_DECIMALS, parseFloat(balanceInEth), //This loses precision, but is a limitation of the current datamodel. This field is essentially deprecated
            balanceInEth.toString(), //This is the actual display field, which has full precision.
            "ETH", //A white lie for display purposes
            "Aurora ETH", //A white lie for display purposes
            auroraIcon, true //isNativeAsset
            );
        });
};
const createNativeFantomParsedTokenAccount = (provider, signerAddress) => {
    return !(provider && signerAddress)
        ? Promise.reject()
        : provider.getBalance(signerAddress).then((balanceInWei) => {
            const balanceInEth = ethers.utils.formatEther(balanceInWei);
            return createParsedTokenAccount(signerAddress, //public key
            WFTM_ADDRESS, //Mint key, On the other side this will be wavax, so this is hopefully a white lie.
            balanceInWei.toString(), //amount, in wei
            WFTM_DECIMALS, parseFloat(balanceInEth), //This loses precision, but is a limitation of the current datamodel. This field is essentially deprecated
            balanceInEth.toString(), //This is the actual display field, which has full precision.
            "FTM", //A white lie for display purposes
            "Fantom", //A white lie for display purposes
            fantomIcon, true //isNativeAsset
            );
        });
};
const createNativeKaruraParsedTokenAccount = (provider, signerAddress) => {
    return !(provider && signerAddress)
        ? Promise.reject()
        : ethers_contracts.TokenImplementation__factory.connect(KAR_ADDRESS, provider)
            .balanceOf(signerAddress)
            .then((balance) => {
            const balanceInEth = ethers.utils.formatUnits(balance, KAR_DECIMALS);
            return createParsedTokenAccount(signerAddress, //public key
            KAR_ADDRESS, //Mint key, On the other side this will be wavax, so this is hopefully a white lie.
            balance.toString(), //amount, in wei
            KAR_DECIMALS, parseFloat(balanceInEth), //This loses precision, but is a limitation of the current datamodel. This field is essentially deprecated
            balanceInEth.toString(), //This is the actual display field, which has full precision.
            "KAR", //A white lie for display purposes
            "KAR", //A white lie for display purposes
            karuraIcon, false //isNativeAsset
            );
        });
};
const createNativeAcalaParsedTokenAccount = (provider, signerAddress) => {
    return !(provider && signerAddress)
        ? Promise.reject()
        : ethers_contracts.TokenImplementation__factory.connect(ACA_ADDRESS, provider)
            .balanceOf(signerAddress)
            .then((balance) => {
            const balanceInEth = ethers.utils.formatUnits(balance, ACA_DECIMALS);
            return createParsedTokenAccount(signerAddress, //public key
            ACA_ADDRESS, //Mint key, On the other side this will be wavax, so this is hopefully a white lie.
            balance.toString(), //amount, in wei
            ACA_DECIMALS, parseFloat(balanceInEth), //This loses precision, but is a limitation of the current datamodel. This field is essentially deprecated
            balanceInEth.toString(), //This is the actual display field, which has full precision.
            "ACA", //A white lie for display purposes
            "ACA", //A white lie for display purposes
            acalaIcon, false //isNativeAsset
            );
        });
};
const createNativeKlaytnParsedTokenAccount = (provider, signerAddress) => {
    return !(provider && signerAddress)
        ? Promise.reject()
        : provider.getBalance(signerAddress).then((balanceInWei) => {
            const balanceInEth = ethers.utils.formatEther(balanceInWei);
            return createParsedTokenAccount(signerAddress, //public key
            WKLAY_ADDRESS, //Mint key, On the other side this will be wklay, so this is hopefully a white lie.
            balanceInWei.toString(), //amount, in wei
            WKLAY_DECIMALS, parseFloat(balanceInEth), //This loses precision, but is a limitation of the current datamodel. This field is essentially deprecated
            balanceInEth.toString(), //This is the actual display field, which has full precision.
            "KLAY", //A white lie for display purposes
            "KLAY", //A white lie for display purposes
            klaytnIcon, true //isNativeAsset
            );
        });
};
const createNativeCeloParsedTokenAccount = (provider, signerAddress) => {
    // Celo has a "native asset" ERC-20
    // https://docs.celo.org/developer-guide/celo-for-eth-devs
    return !(provider && signerAddress)
        ? Promise.reject()
        : ethers_contracts.TokenImplementation__factory.connect(CELO_ADDRESS, provider)
            .balanceOf(signerAddress)
            .then((balance) => {
            const balanceInEth = ethers.utils.formatUnits(balance, CELO_DECIMALS);
            return createParsedTokenAccount(signerAddress, //public key
            CELO_ADDRESS, //Mint key, On the other side this will be wavax, so this is hopefully a white lie.
            balance.toString(), //amount, in wei
            CELO_DECIMALS, parseFloat(balanceInEth), //This loses precision, but is a limitation of the current datamodel. This field is essentially deprecated
            balanceInEth.toString(), //This is the actual display field, which has full precision.
            "CELO", //A white lie for display purposes
            "CELO", //A white lie for display purposes
            celoIcon, false //isNativeAsset
            );
        });
};
const createNativeNeonParsedTokenAccount = (provider, signerAddress) => {
    return !(provider && signerAddress)
        ? Promise.reject()
        : provider.getBalance(signerAddress).then((balanceInWei) => {
            const balanceInEth = ethers.utils.formatEther(balanceInWei);
            return createParsedTokenAccount(signerAddress, //public key
            WNEON_ADDRESS, //Mint key, On the other side this will be wneon, so this is hopefully a white lie.
            balanceInWei.toString(), //amount, in wei
            WNEON_DECIMALS, parseFloat(balanceInEth), //This loses precision, but is a limitation of the current datamodel. This field is essentially deprecated
            balanceInEth.toString(), //This is the actual display field, which has full precision.
            "NEON", //A white lie for display purposes
            "NEON", //A white lie for display purposes
            neonIcon, true //isNativeAsset
            );
        });
};
const createNativeMoonbeamParsedTokenAccount = (provider, signerAddress) => {
    return !(provider && signerAddress)
        ? Promise.reject()
        : provider.getBalance(signerAddress).then((balanceInWei) => {
            const balanceInEth = ethers.utils.formatEther(balanceInWei);
            return createParsedTokenAccount(signerAddress, //public key
            WGLMR_ADDRESS, //Mint key, On the other side this will be wneon, so this is hopefully a white lie.
            balanceInWei.toString(), //amount, in wei
            WGLMR_DECIMALS, parseFloat(balanceInEth), //This loses precision, but is a limitation of the current datamodel. This field is essentially deprecated
            balanceInEth.toString(), //This is the actual display field, which has full precision.
            "GLMR", //A white lie for display purposes
            "GLMR", //A white lie for display purposes
            moonbeamIcon, true //isNativeAsset
            );
        });
};
const createNFTParsedTokenAccountFromCovalent = (walletAddress, covalent, nft_data) => {
    return {
        publicKey: walletAddress,
        mintKey: covalent.contract_address,
        amount: nft_data.token_balance,
        decimals: covalent.contract_decimals,
        uiAmount: Number(formatUnits(nft_data.token_balance, covalent.contract_decimals)),
        uiAmountString: formatUnits(nft_data.token_balance, covalent.contract_decimals),
        symbol: covalent.contract_ticker_symbol,
        name: covalent.contract_name,
        logo: covalent.logo_url,
        tokenId: nft_data.token_id,
        uri: nft_data.token_url,
        animation_url: nft_data.external_data.animation_url,
        external_url: nft_data.external_data.external_url,
        image: nft_data.external_data.image,
        image_256: nft_data.external_data.image_256,
        nftName: nft_data.external_data.name,
        description: nft_data.external_data.description,
    };
};
const getEthereumAccountsCovalent = async (url, nft, chainId) => {
    try {
        const output = [];
        const response = await axios.get(url);
        const tokens = response.data.data.items;
        if (tokens instanceof Array && tokens.length) {
            for (const item of tokens) {
                // TODO: filter?
                if (item.contract_decimals !== undefined &&
                    item.contract_address &&
                    item.contract_address.toLowerCase() !==
                        getDefaultNativeCurrencyAddressEvm(chainId).toLowerCase() && // native balance comes from querying token bridge
                    item.balance &&
                    item.balance !== "0" &&
                    (nft
                        ? item.supports_erc?.includes("erc721")
                        : item.supports_erc?.includes("erc20"))) {
                    output.push({ ...item });
                }
            }
        }
        return output;
    }
    catch (error) {
        return Promise.reject("Unable to retrieve your Ethereum Tokens.");
    }
};
export const getEthereumAccountsBlockscout = async (url, nft, chainId) => {
    try {
        const output = [];
        const response = await axios.get(url);
        const tokens = response.data.result;
        if (tokens instanceof Array && tokens.length) {
            for (const item of tokens) {
                if (item.decimals !== undefined &&
                    item.contractAddress &&
                    item.contractAddress.toLowerCase() !==
                        getDefaultNativeCurrencyAddressEvm(chainId).toLowerCase() && // native balance comes from querying token bridge
                    item.balance &&
                    item.balance !== "0" &&
                    (nft ? item.type?.includes("ERC-721") : item.type?.includes("ERC-20"))) {
                    output.push({
                        contract_decimals: item.decimals,
                        contract_address: item.contractAddress,
                        balance: item.balance,
                        contract_ticker_symbol: item.symbol,
                        contract_name: item.name,
                        logo_url: "",
                        quote: 0,
                        quote_rate: 0,
                    });
                }
            }
        }
        return output;
    }
    catch (error) {
        return Promise.reject("Unable to retrieve your Ethereum Tokens.");
    }
};
const getSolanaParsedTokenAccounts = async (walletAddress, dispatch, nft) => {
    const connection = new Connection(SOLANA_HOST, "confirmed");
    dispatch(nft ? fetchSourceParsedTokenAccountsNFT() : fetchSourceParsedTokenAccounts());
    try {
        //No matter what, we retrieve the spl tokens associated to this address.
        let splParsedTokenAccounts = await connection
            .getParsedTokenAccountsByOwner(new PublicKey(walletAddress), {
            programId: new PublicKey(TOKEN_PROGRAM_ID),
        })
            .then((result) => {
            return result.value.map((item) => createParsedTokenAccountFromInfo(item.pubkey, item.account));
        });
        // uncomment to test token account in picker, useful for debugging
        // splParsedTokenAccounts.push({
        //   amount: "1",
        //   decimals: 8,
        //   mintKey: "2Xf2yAXJfg82sWwdLUo2x9mZXy6JCdszdMZkcF1Hf4KV",
        //   publicKey: "2Xf2yAXJfg82sWwdLUo2x9mZXy6JCdszdMZkcF1Hf4KV",
        //   uiAmount: 1,
        //   uiAmountString: "1",
        //   isNativeAsset: false,
        // });
        if (nft) {
            //In the case of NFTs, we are done, and we set the accounts in redux
            dispatch(receiveSourceParsedTokenAccountsNFT(splParsedTokenAccounts));
        }
        else {
            //In the transfer case, we also pull the SOL balance of the wallet, and prepend it at the beginning of the list.
            const nativeAccount = await createNativeSolParsedTokenAccount(connection, walletAddress);
            if (nativeAccount !== null) {
                splParsedTokenAccounts.unshift(nativeAccount);
            }
            dispatch(receiveSourceParsedTokenAccounts(splParsedTokenAccounts));
        }
    }
    catch (e) {
        console.error(e);
        dispatch(nft
            ? errorSourceParsedTokenAccountsNFT("Failed to load NFT metadata")
            : errorSourceParsedTokenAccounts("Failed to load token metadata."));
    }
};
const getAlgorandParsedTokenAccounts = async (walletAddress, dispatch, nft) => {
    dispatch(nft ? fetchSourceParsedTokenAccountsNFT() : fetchSourceParsedTokenAccounts());
    try {
        const algodClient = new Algodv2(ALGORAND_HOST.algodToken, ALGORAND_HOST.algodServer, ALGORAND_HOST.algodPort);
        const accountInfo = await algodClient
            .accountInformation(walletAddress)
            .do();
        const parsedTokenAccounts = [];
        for (const asset of accountInfo.assets) {
            const assetId = asset["asset-id"];
            const amount = asset.amount;
            const metadata = await fetchSingleMetadata(assetId, algodClient);
            const isNFT = amount === 1 && metadata.decimals === 0;
            if (((nft && isNFT) || (!nft && !isNFT)) && amount > 0) {
                parsedTokenAccounts.push(createParsedTokenAccount(walletAddress, assetId.toString(), amount, metadata.decimals, parseFloat(formatUnits(amount, metadata.decimals)), formatUnits(amount, metadata.decimals).toString(), metadata.symbol, metadata.tokenName, undefined, false));
            }
        }
        if (nft) {
            dispatch(receiveSourceParsedTokenAccountsNFT(parsedTokenAccounts));
            return;
        }
        // The ALGOs account is prepended for the non NFT case
        parsedTokenAccounts.unshift(createParsedTokenAccount(walletAddress, //publicKey
        "0", //asset ID
        accountInfo.amount, //amount
        ALGO_DECIMALS, parseFloat(formatUnits(accountInfo.amount, ALGO_DECIMALS)), formatUnits(accountInfo.amount, ALGO_DECIMALS).toString(), "ALGO", "Algo", undefined, //TODO logo
        true));
        dispatch(receiveSourceParsedTokenAccounts(parsedTokenAccounts));
    }
    catch (e) {
        console.error(e);
        dispatch(nft
            ? errorSourceParsedTokenAccountsNFT("Failed to load NFT metadata")
            : errorSourceParsedTokenAccounts("Failed to load token metadata."));
    }
};
const getNearParsedTokenAccounts = async (walletAddress, dispatch, nft) => {
    dispatch(nft ? fetchSourceParsedTokenAccountsNFT() : fetchSourceParsedTokenAccounts());
    try {
        if (nft) {
            dispatch(receiveSourceParsedTokenAccountsNFT([]));
            return;
        }
        const account = await makeNearAccount(walletAddress);
        const balance = await account.getAccountBalance();
        const nativeNear = createParsedTokenAccount(walletAddress, //publicKey
        NATIVE_NEAR_PLACEHOLDER, //the app doesn't like when this isn't truthy
        balance.available, //amount
        NATIVE_NEAR_DECIMALS, parseFloat(formatUnits(balance.available, NATIVE_NEAR_DECIMALS)), formatUnits(balance.available, NATIVE_NEAR_DECIMALS).toString(), "NEAR", "Near", undefined, //TODO logo
        true);
        dispatch(receiveSourceParsedTokenAccounts([nativeNear]));
    }
    catch (e) {
        console.error(e);
        dispatch(nft
            ? errorSourceParsedTokenAccountsNFT("Failed to load NFT metadata")
            : errorSourceParsedTokenAccounts("Failed to load token metadata."));
    }
};
const getSuiParsedTokenAccounts = async (walletAddress, dispatch, nft) => {
    dispatch(nft ? fetchSourceParsedTokenAccountsNFT() : fetchSourceParsedTokenAccounts());
    try {
        if (nft) {
            dispatch(receiveSourceParsedTokenAccountsNFT([]));
            return;
        }
        const provider = getSuiProvider();
        const balances = await provider.getAllBalances({ owner: walletAddress });
        const parsedTokenAccounts = [];
        for (const { coinType, totalBalance } of balances) {
            if (totalBalance === "0")
                continue;
            const response = await provider.getCoinMetadata({
                coinType,
            });
            if (!response)
                throw new Error("bad response");
            const { decimals, symbol, name } = response;
            const parsedTokenAccount = createParsedTokenAccount(walletAddress, coinType, totalBalance, decimals, Number(formatUnits(totalBalance, decimals)), formatUnits(totalBalance, decimals), symbol, name);
            if (coinType === SUI_NATIVE_TOKEN_KEY) {
                parsedTokenAccount.logo = suiIcon;
                parsedTokenAccount.isNativeAsset = true;
                parsedTokenAccounts.unshift(parsedTokenAccount);
            }
            else {
                parsedTokenAccounts.push(parsedTokenAccount);
            }
        }
        dispatch(receiveSourceParsedTokenAccounts(parsedTokenAccounts));
    }
    catch (e) {
        console.error(e);
        dispatch(nft
            ? errorSourceParsedTokenAccountsNFT("Failed to load NFT metadata")
            : errorSourceParsedTokenAccounts("Failed to load token metadata."));
    }
};
/**
 * Fetches the balance of an asset for the connected wallet
 * This should handle every type of chain in the future, but only reads the Transfer state.
 */
function useGetAvailableTokens(nft = false) {
    const dispatch = useDispatch();
    const tokenAccounts = useSelector(nft
        ? selectNFTSourceParsedTokenAccounts
        : selectTransferSourceParsedTokenAccounts);
    const lookupChain = useSelector(nft ? selectNFTSourceChain : selectTransferSourceChain);
    const solanaWallet = useSolanaWallet();
    const solPK = solanaWallet?.publicKey;
    const { provider, signerAddress } = useEthereumProvider();
    const { accounts: algoAccounts } = useAlgorandContext();
    const { accountId: nearAccountId } = useNearContext();
    const { address: suiAddress } = useWallet();
    const [covalent, setCovalent] = useState(undefined);
    const [covalentLoading, setCovalentLoading] = useState(false);
    const [covalentError, setCovalentError] = useState(undefined);
    const [ethNativeAccount, setEthNativeAccount] = useState(undefined);
    const [ethNativeAccountLoading, setEthNativeAccountLoading] = useState(false);
    const [ethNativeAccountError, setEthNativeAccountError] = useState(undefined);
    const [solanaMintAccounts, setSolanaMintAccounts] = useState(undefined);
    const [solanaMintAccountsLoading, setSolanaMintAccountsLoading] = useState(false);
    const [solanaMintAccountsError, setSolanaMintAccountsError] = useState(undefined);
    const selectedSourceWalletAddress = useSelector(nft ? selectNFTSourceWalletAddress : selectSourceWalletAddress);
    const currentSourceWalletAddress = isEVMChain(lookupChain)
        ? signerAddress
        : lookupChain === CHAIN_ID_SOLANA
            ? solPK?.toString()
            : lookupChain === CHAIN_ID_ALGORAND
                ? algoAccounts[0]?.address
                : lookupChain === CHAIN_ID_NEAR
                    ? nearAccountId || undefined
                    : lookupChain === CHAIN_ID_SUI
                        ? suiAddress
                        : undefined;
    const resetSourceAccounts = useCallback(() => {
        dispatch(nft
            ? setSourceWalletAddressNFT(undefined)
            : setSourceWalletAddress(undefined));
        dispatch(nft
            ? setSourceParsedTokenAccountNFT(undefined)
            : setSourceParsedTokenAccount(undefined));
        dispatch(nft
            ? setSourceParsedTokenAccountsNFT(undefined)
            : setSourceParsedTokenAccounts(undefined));
        !nft && dispatch(setAmount(""));
        setCovalent(undefined); //These need to be included in the reset because they have balances on them.
        setCovalentLoading(false);
        setCovalentError("");
        setEthNativeAccount(undefined);
        setEthNativeAccountLoading(false);
        setEthNativeAccountError("");
    }, [setCovalent, dispatch, nft]);
    //TODO this useEffect could be somewhere else in the codebase
    //It resets the SourceParsedTokens accounts when the wallet changes
    useEffect(() => {
        if (selectedSourceWalletAddress !== undefined &&
            currentSourceWalletAddress !== undefined &&
            currentSourceWalletAddress !== selectedSourceWalletAddress) {
            resetSourceAccounts();
            return;
        }
        else {
        }
    }, [
        selectedSourceWalletAddress,
        currentSourceWalletAddress,
        dispatch,
        resetSourceAccounts,
    ]);
    //Solana accountinfos load
    useEffect(() => {
        if (lookupChain === CHAIN_ID_SOLANA && solPK) {
            if (!(tokenAccounts.data || tokenAccounts.isFetching || tokenAccounts.error)) {
                getSolanaParsedTokenAccounts(solPK.toString(), dispatch, nft);
            }
        }
        return () => { };
    }, [dispatch, solanaWallet, lookupChain, solPK, tokenAccounts, nft]);
    //Solana Mint Accounts lookup
    useEffect(() => {
        if (lookupChain !== CHAIN_ID_SOLANA || !tokenAccounts.data?.length) {
            return () => { };
        }
        let cancelled = false;
        setSolanaMintAccountsLoading(true);
        setSolanaMintAccountsError(undefined);
        const mintAddresses = tokenAccounts.data.map((x) => x.mintKey);
        //This is a known wormhole v1 token on testnet
        // mintAddresses.push("4QixXecTZ4zdZGa39KH8gVND5NZ2xcaB12wiBhE4S7rn");
        //SOLT devnet token
        // mintAddresses.push("2WDq7wSs9zYrpx2kbHDA4RUTRch2CCTP6ZWaH4GNfnQQ");
        // bad monkey "NFT"
        // mintAddresses.push("5FJeEJR8576YxXFdGRAu4NBBFcyfmtjsZrXHSsnzNPdS");
        // degenerate monkey NFT
        // mintAddresses.push("EzYsbigNNGbNuANRJ3mnnyJYU2Bk7mBYVsxuonUwAX7r");
        const connection = new Connection(SOLANA_HOST, "confirmed");
        getMultipleAccountsRPC(connection, mintAddresses.map((x) => new PublicKey(x))).then((results) => {
            if (!cancelled) {
                const output = new Map();
                results.forEach((result, index) => output.set(mintAddresses[index], (result && extractMintInfo(result)) || null));
                setSolanaMintAccounts(output);
                setSolanaMintAccountsLoading(false);
            }
        }, (error) => {
            if (!cancelled) {
                setSolanaMintAccounts(undefined);
                setSolanaMintAccountsLoading(false);
                setSolanaMintAccountsError("Could not retrieve Solana mint accounts.");
            }
        });
        return () => (cancelled = true);
    }, [tokenAccounts.data, lookupChain]);
    //Ethereum native asset load
    useEffect(() => {
        let cancelled = false;
        if (signerAddress &&
            lookupChain === CHAIN_ID_ETH &&
            !ethNativeAccount &&
            !nft) {
            setEthNativeAccountLoading(true);
            createNativeEthParsedTokenAccount(provider, signerAddress).then((result) => {
                console.log("create native account returned with value", result);
                if (!cancelled) {
                    setEthNativeAccount(result);
                    setEthNativeAccountLoading(false);
                    setEthNativeAccountError("");
                }
            }, (error) => {
                if (!cancelled) {
                    setEthNativeAccount(undefined);
                    setEthNativeAccountLoading(false);
                    setEthNativeAccountError("Unable to retrieve your ETH balance.");
                }
            });
        }
        return () => {
            cancelled = true;
        };
    }, [lookupChain, provider, signerAddress, nft, ethNativeAccount]);
    //Sepolia native asset load
    useEffect(() => {
        let cancelled = false;
        if (signerAddress &&
            lookupChain === CHAIN_ID_SEPOLIA &&
            !ethNativeAccount &&
            !nft) {
            setEthNativeAccountLoading(true);
            createNativeSepoliaParsedTokenAccount(provider, signerAddress).then((result) => {
                console.log("create native account returned with value", result);
                if (!cancelled) {
                    setEthNativeAccount(result);
                    setEthNativeAccountLoading(false);
                    setEthNativeAccountError("");
                }
            }, (error) => {
                if (!cancelled) {
                    setEthNativeAccount(undefined);
                    setEthNativeAccountLoading(false);
                    setEthNativeAccountError("Unable to retrieve your Sepolia ETH balance.");
                }
            });
        }
        return () => {
            cancelled = true;
        };
    }, [lookupChain, provider, signerAddress, nft, ethNativeAccount]);
    //Binance Smart Chain native asset load
    useEffect(() => {
        let cancelled = false;
        if (signerAddress &&
            lookupChain === CHAIN_ID_BSC &&
            !ethNativeAccount &&
            !nft) {
            setEthNativeAccountLoading(true);
            createNativeBscParsedTokenAccount(provider, signerAddress).then((result) => {
                console.log("create native account returned with value", result);
                if (!cancelled) {
                    setEthNativeAccount(result);
                    setEthNativeAccountLoading(false);
                    setEthNativeAccountError("");
                }
            }, (error) => {
                if (!cancelled) {
                    setEthNativeAccount(undefined);
                    setEthNativeAccountLoading(false);
                    setEthNativeAccountError("Unable to retrieve your BNB balance.");
                }
            });
        }
        return () => {
            cancelled = true;
        };
    }, [lookupChain, provider, signerAddress, nft, ethNativeAccount]);
    //Polygon native asset load
    useEffect(() => {
        let cancelled = false;
        if (signerAddress &&
            lookupChain === CHAIN_ID_POLYGON &&
            !ethNativeAccount &&
            !nft) {
            setEthNativeAccountLoading(true);
            createNativePolygonParsedTokenAccount(provider, signerAddress).then((result) => {
                console.log("create native account returned with value", result);
                if (!cancelled) {
                    setEthNativeAccount(result);
                    setEthNativeAccountLoading(false);
                    setEthNativeAccountError("");
                }
            }, (error) => {
                if (!cancelled) {
                    setEthNativeAccount(undefined);
                    setEthNativeAccountLoading(false);
                    setEthNativeAccountError("Unable to retrieve your MATIC balance.");
                }
            });
        }
        return () => {
            cancelled = true;
        };
    }, [lookupChain, provider, signerAddress, nft, ethNativeAccount]);
    //TODO refactor all these into an isEVM effect
    //avax native asset load
    useEffect(() => {
        let cancelled = false;
        if (signerAddress &&
            lookupChain === CHAIN_ID_AVAX &&
            !ethNativeAccount &&
            !nft) {
            setEthNativeAccountLoading(true);
            createNativeAvaxParsedTokenAccount(provider, signerAddress).then((result) => {
                console.log("create native account returned with value", result);
                if (!cancelled) {
                    setEthNativeAccount(result);
                    setEthNativeAccountLoading(false);
                    setEthNativeAccountError("");
                }
            }, (error) => {
                if (!cancelled) {
                    setEthNativeAccount(undefined);
                    setEthNativeAccountLoading(false);
                    setEthNativeAccountError("Unable to retrieve your AVAX balance.");
                }
            });
        }
        return () => {
            cancelled = true;
        };
    }, [lookupChain, provider, signerAddress, nft, ethNativeAccount]);
    useEffect(() => {
        let cancelled = false;
        if (signerAddress &&
            lookupChain === CHAIN_ID_OASIS &&
            !ethNativeAccount &&
            !nft) {
            setEthNativeAccountLoading(true);
            createNativeOasisParsedTokenAccount(provider, signerAddress).then((result) => {
                console.log("create native account returned with value", result);
                if (!cancelled) {
                    setEthNativeAccount(result);
                    setEthNativeAccountLoading(false);
                    setEthNativeAccountError("");
                }
            }, (error) => {
                if (!cancelled) {
                    setEthNativeAccount(undefined);
                    setEthNativeAccountLoading(false);
                    setEthNativeAccountError("Unable to retrieve your Oasis balance.");
                }
            });
        }
        return () => {
            cancelled = true;
        };
    }, [lookupChain, provider, signerAddress, nft, ethNativeAccount]);
    useEffect(() => {
        let cancelled = false;
        if (signerAddress &&
            lookupChain === CHAIN_ID_AURORA &&
            !ethNativeAccount &&
            !nft) {
            setEthNativeAccountLoading(true);
            createNativeAuroraParsedTokenAccount(provider, signerAddress).then((result) => {
                console.log("create native account returned with value", result);
                if (!cancelled) {
                    setEthNativeAccount(result);
                    setEthNativeAccountLoading(false);
                    setEthNativeAccountError("");
                }
            }, (error) => {
                if (!cancelled) {
                    setEthNativeAccount(undefined);
                    setEthNativeAccountLoading(false);
                    setEthNativeAccountError("Unable to retrieve your Fantom balance.");
                }
            });
        }
        return () => {
            cancelled = true;
        };
    }, [lookupChain, provider, signerAddress, nft, ethNativeAccount]);
    useEffect(() => {
        let cancelled = false;
        if (signerAddress &&
            lookupChain === CHAIN_ID_FANTOM &&
            !ethNativeAccount &&
            !nft) {
            setEthNativeAccountLoading(true);
            createNativeFantomParsedTokenAccount(provider, signerAddress).then((result) => {
                console.log("create native account returned with value", result);
                if (!cancelled) {
                    setEthNativeAccount(result);
                    setEthNativeAccountLoading(false);
                    setEthNativeAccountError("");
                }
            }, (error) => {
                if (!cancelled) {
                    setEthNativeAccount(undefined);
                    setEthNativeAccountLoading(false);
                    setEthNativeAccountError("Unable to retrieve your Fantom balance.");
                }
            });
        }
        return () => {
            cancelled = true;
        };
    }, [lookupChain, provider, signerAddress, nft, ethNativeAccount]);
    useEffect(() => {
        let cancelled = false;
        if (signerAddress &&
            lookupChain === CHAIN_ID_KARURA &&
            !ethNativeAccount &&
            !nft) {
            setEthNativeAccountLoading(true);
            createNativeKaruraParsedTokenAccount(provider, signerAddress).then((result) => {
                console.log("create native account returned with value", result);
                if (!cancelled) {
                    setEthNativeAccount(result);
                    setEthNativeAccountLoading(false);
                    setEthNativeAccountError("");
                }
            }, (error) => {
                if (!cancelled) {
                    setEthNativeAccount(undefined);
                    setEthNativeAccountLoading(false);
                    setEthNativeAccountError("Unable to retrieve your Karura balance.");
                }
            });
        }
        return () => {
            cancelled = true;
        };
    }, [lookupChain, provider, signerAddress, nft, ethNativeAccount]);
    useEffect(() => {
        let cancelled = false;
        if (signerAddress &&
            lookupChain === CHAIN_ID_ACALA &&
            !ethNativeAccount &&
            !nft) {
            setEthNativeAccountLoading(true);
            createNativeAcalaParsedTokenAccount(provider, signerAddress).then((result) => {
                console.log("create native account returned with value", result);
                if (!cancelled) {
                    setEthNativeAccount(result);
                    setEthNativeAccountLoading(false);
                    setEthNativeAccountError("");
                }
            }, (error) => {
                if (!cancelled) {
                    setEthNativeAccount(undefined);
                    setEthNativeAccountLoading(false);
                    setEthNativeAccountError("Unable to retrieve your Acala balance.");
                }
            });
        }
        return () => {
            cancelled = true;
        };
    }, [lookupChain, provider, signerAddress, nft, ethNativeAccount]);
    useEffect(() => {
        let cancelled = false;
        if (signerAddress &&
            lookupChain === CHAIN_ID_KLAYTN &&
            !ethNativeAccount &&
            !nft) {
            setEthNativeAccountLoading(true);
            createNativeKlaytnParsedTokenAccount(provider, signerAddress).then((result) => {
                console.log("create native account returned with value", result);
                if (!cancelled) {
                    setEthNativeAccount(result);
                    setEthNativeAccountLoading(false);
                    setEthNativeAccountError("");
                }
            }, (error) => {
                if (!cancelled) {
                    setEthNativeAccount(undefined);
                    setEthNativeAccountLoading(false);
                    setEthNativeAccountError("Unable to retrieve your Klaytn balance.");
                }
            });
        }
        return () => {
            cancelled = true;
        };
    }, [lookupChain, provider, signerAddress, nft, ethNativeAccount]);
    useEffect(() => {
        let cancelled = false;
        if (signerAddress &&
            lookupChain === CHAIN_ID_CELO &&
            !ethNativeAccount &&
            !nft) {
            setEthNativeAccountLoading(true);
            createNativeCeloParsedTokenAccount(provider, signerAddress).then((result) => {
                console.log("create native account returned with value", result);
                if (!cancelled) {
                    setEthNativeAccount(result);
                    setEthNativeAccountLoading(false);
                    setEthNativeAccountError("");
                }
            }, (error) => {
                if (!cancelled) {
                    setEthNativeAccount(undefined);
                    setEthNativeAccountLoading(false);
                    setEthNativeAccountError("Unable to retrieve your Celo balance.");
                }
            });
        }
        return () => {
            cancelled = true;
        };
    }, [lookupChain, provider, signerAddress, nft, ethNativeAccount]);
    useEffect(() => {
        let cancelled = false;
        if (signerAddress &&
            lookupChain === CHAIN_ID_NEON &&
            !ethNativeAccount &&
            !nft) {
            setEthNativeAccountLoading(true);
            createNativeNeonParsedTokenAccount(provider, signerAddress).then((result) => {
                console.log("create native account returned with value", result);
                if (!cancelled) {
                    setEthNativeAccount(result);
                    setEthNativeAccountLoading(false);
                    setEthNativeAccountError("");
                }
            }, (error) => {
                if (!cancelled) {
                    setEthNativeAccount(undefined);
                    setEthNativeAccountLoading(false);
                    setEthNativeAccountError("Unable to retrieve your Neon balance.");
                }
            });
        }
        return () => {
            cancelled = true;
        };
    }, [lookupChain, provider, signerAddress, nft, ethNativeAccount]);
    useEffect(() => {
        let cancelled = false;
        if (signerAddress &&
            lookupChain === CHAIN_ID_MOONBEAM &&
            !ethNativeAccount &&
            !nft) {
            setEthNativeAccountLoading(true);
            createNativeMoonbeamParsedTokenAccount(provider, signerAddress).then((result) => {
                console.log("create native account returned with value", result);
                if (!cancelled) {
                    setEthNativeAccount(result);
                    setEthNativeAccountLoading(false);
                    setEthNativeAccountError("");
                }
            }, (error) => {
                if (!cancelled) {
                    setEthNativeAccount(undefined);
                    setEthNativeAccountLoading(false);
                    setEthNativeAccountError("Unable to retrieve your Moonbeam balance.");
                }
            });
        }
        return () => {
            cancelled = true;
        };
    }, [lookupChain, provider, signerAddress, nft, ethNativeAccount]);
    //Ethereum covalent or blockscout accounts load
    useEffect(() => {
        //const testWallet = "0xf60c2ea62edbfe808163751dd0d8693dcb30019c";
        // const nftTestWallet1 = "0x3f304c6721f35ff9af00fd32650c8e0a982180ab";
        // const nftTestWallet2 = "0x98ed231428088eb440e8edb5cc8d66dcf913b86e";
        // const nftTestWallet3 = "0xb1fadf677a7e9b90e9d4f31c8ffb3dc18c138c6f";
        // const nftBscTestWallet1 = "0x5f464a652bd1991df0be37979b93b3306d64a909";
        let cancelled = false;
        const walletAddress = signerAddress;
        if (walletAddress && isEVMChain(lookupChain) && !covalent) {
            let url = COVALENT_GET_TOKENS_URL(lookupChain, walletAddress, nft);
            let getAccounts;
            if (url) {
                getAccounts = getEthereumAccountsCovalent;
            }
            else {
                url = BLOCKSCOUT_GET_TOKENS_URL(lookupChain, walletAddress);
                getAccounts = getEthereumAccountsBlockscout;
            }
            if (!url) {
                return;
            }
            //TODO less cancel
            !cancelled && setCovalentLoading(true);
            !cancelled &&
                dispatch(nft
                    ? fetchSourceParsedTokenAccountsNFT()
                    : fetchSourceParsedTokenAccounts());
            getAccounts(url, nft, lookupChain).then((accounts) => {
                !cancelled && setCovalentLoading(false);
                !cancelled && setCovalentError(undefined);
                !cancelled && setCovalent(accounts);
                !cancelled &&
                    dispatch(nft
                        ? receiveSourceParsedTokenAccountsNFT(accounts.reduce((arr, current) => {
                            if (current.nft_data) {
                                current.nft_data.forEach((x) => arr.push(createNFTParsedTokenAccountFromCovalent(walletAddress, current, x)));
                            }
                            return arr;
                        }, []))
                        : receiveSourceParsedTokenAccounts(accounts.map((x) => createParsedTokenAccountFromCovalent(walletAddress, x))));
            }, () => {
                !cancelled &&
                    dispatch(nft
                        ? errorSourceParsedTokenAccountsNFT("Cannot load your Ethereum NFTs at the moment.")
                        : errorSourceParsedTokenAccounts("Cannot load your Ethereum tokens at the moment."));
                !cancelled &&
                    setCovalentError("Cannot load your Ethereum tokens at the moment.");
                !cancelled && setCovalentLoading(false);
            });
            return () => {
                cancelled = true;
            };
        }
    }, [lookupChain, provider, signerAddress, dispatch, nft, covalent]);
    //Terra accounts load
    //At present, we don't have any mechanism for doing this.
    useEffect(() => { }, []);
    //Algorand accounts load
    useEffect(() => {
        if (lookupChain === CHAIN_ID_ALGORAND && currentSourceWalletAddress) {
            if (!(tokenAccounts.data || tokenAccounts.isFetching || tokenAccounts.error)) {
                getAlgorandParsedTokenAccounts(currentSourceWalletAddress, dispatch, nft);
            }
        }
        return () => { };
    }, [dispatch, lookupChain, currentSourceWalletAddress, tokenAccounts, nft]);
    //Near accounts load
    useEffect(() => {
        if (lookupChain === CHAIN_ID_NEAR && currentSourceWalletAddress) {
            if (!(tokenAccounts.data || tokenAccounts.isFetching || tokenAccounts.error)) {
                getNearParsedTokenAccounts(currentSourceWalletAddress, dispatch, nft);
            }
        }
        return () => { };
    }, [dispatch, lookupChain, currentSourceWalletAddress, tokenAccounts, nft]);
    //Sui accounts load
    useEffect(() => {
        if (lookupChain === CHAIN_ID_SUI && currentSourceWalletAddress) {
            if (!(tokenAccounts.data || tokenAccounts.isFetching || tokenAccounts.error)) {
                getSuiParsedTokenAccounts(currentSourceWalletAddress, dispatch, nft);
            }
        }
        return () => { };
    }, [dispatch, lookupChain, currentSourceWalletAddress, tokenAccounts, nft]);
    const ethAccounts = useMemo(() => {
        const output = { ...tokenAccounts };
        output.data = output.data?.slice() || [];
        output.isFetching = output.isFetching || ethNativeAccountLoading;
        output.error = output.error || ethNativeAccountError;
        ethNativeAccount && output.data && output.data.unshift(ethNativeAccount);
        return output;
    }, [
        ethNativeAccount,
        ethNativeAccountLoading,
        ethNativeAccountError,
        tokenAccounts,
    ]);
    return lookupChain === CHAIN_ID_SOLANA
        ? {
            tokenAccounts,
            mintAccounts: {
                data: solanaMintAccounts,
                isFetching: solanaMintAccountsLoading,
                error: solanaMintAccountsError,
                receivedAt: null, //TODO
            },
            resetAccounts: resetSourceAccounts,
        }
        : isEVMChain(lookupChain)
            ? {
                tokenAccounts: ethAccounts,
                covalent: {
                    data: covalent,
                    isFetching: covalentLoading,
                    error: covalentError,
                    receivedAt: null, //TODO
                },
                resetAccounts: resetSourceAccounts,
            }
            : isTerraChain(lookupChain)
                ? {
                    resetAccounts: resetSourceAccounts,
                }
                : lookupChain === CHAIN_ID_XPLA
                    ? {
                        resetAccounts: resetSourceAccounts,
                    }
                    : lookupChain === CHAIN_ID_APTOS
                        ? {
                            resetAccounts: resetSourceAccounts,
                        }
                        : lookupChain === CHAIN_ID_ALGORAND
                            ? {
                                tokenAccounts,
                                resetAccounts: resetSourceAccounts,
                            }
                            : lookupChain === CHAIN_ID_INJECTIVE
                                ? {
                                    resetAccounts: resetSourceAccounts,
                                }
                                : lookupChain === CHAIN_ID_SEI
                                    ? {
                                        resetAccounts: resetSourceAccounts,
                                    }
                                    : lookupChain === CHAIN_ID_NEAR
                                        ? {
                                            tokenAccounts,
                                            resetAccounts: resetSourceAccounts,
                                        }
                                        : lookupChain === CHAIN_ID_SUI
                                            ? {
                                                tokenAccounts,
                                                resetAccounts: resetSourceAccounts,
                                            }
                                            : undefined;
}
export default useGetAvailableTokens;