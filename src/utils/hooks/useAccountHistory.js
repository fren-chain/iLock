import { useEffect, useState } from 'react';
// import mainToken from '../../utils/main-token.json';
import mainToken from "../../utils/constants/tokenList/rigelprotocol-main-tokenlist.json";
import TokenLogo from '../../assets/Null-24.svg';
import { getERC20Token } from "../utilsFunctions";
import { ethers } from 'ethers';
import SmartSwapRouter02 from '../abis/swapAbiForDecoder.json';
import { useDispatch, useSelector } from "react-redux";
import { useLocation } from 'react-router-dom';
import { SMARTSWAPROUTER, WNATIVEADDRESSES, AUTOSWAPSTATEADDRESSES, MARKETFREESWAPADDRESSES, MARKETAUTOSWAPADDRESSES } from "../addresses";
import Web3 from 'web3';
import { useNativeBalance } from "../../utils/hooks/useBalances";
import { ParseFloat } from '..';
import { notificationTab } from '../../state/transaction/actions';
import { SupportedChainName, SupportedChainSymbols } from '../constants/chains';
import { useActiveWeb3React } from './useActiveWeb3React';
const abiDecoder = require('abi-decoder');
export function timeConverter(UNIX_timestamp) {
    const a = new Date(UNIX_timestamp * 1000);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const year = a.getFullYear();
    const month = months[a.getMonth()];
    const date = a.getDate();
    const hour = a.getHours() < 10 ? `0${a.getHours()}` : a.getHours();
    const min = a.getMinutes() < 10 ? `0${a.getMinutes()}` : a.getMinutes();
    const sec = a.getSeconds() < 10 ? `0${a.getSeconds()}` : a.getSeconds();
    return date + ' ' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec;
}
export const APIENDPOINT = {
    "1": "",
    "3": "",
    "56": "api.bscscan.com/api",
    "97": "api-testnet.bscscan.com/api",
    "137": "api.polygonscan.com/api",
    "80001": "api-testnet.polygonscan.com/api",
    "42261": "testnet.explorer.emerald.oasis.dev/api",
    "42262": "explorer.emerald.oasis.dev/api",
    "43114": "api.avax-test.network/ext/bc/C/rpc",
    "43113": "api.avax.network/ext/bc/C/rpc",
};
export const APIKEY = {
    "1": "",
    "3": "",
    "56": "AATZWFQ47VX3Y1DN7M97BJ5FEJR6MGRQSD",
    "97": "AATZWFQ47VX3Y1DN7M97BJ5FEJR6MGRQSD",
    "137": "89B4F6NVVEVGC8EMDCJVRJMVGSCVHHZTR7",
    "80001": "89B4F6NVVEVGC8EMDCJVRJMVGSCVHHZTR7",
    "42261": "",
    "42262": "",
    "43114": "",
    "43113": "",
};
let web3 = new Web3(Web3.givenProvider);
export const formatAmount = (number, decimals) => {
    const num = ethers.BigNumber.from(number).toString();
    let res = ethers.utils.formatUnits(num, decimals);
    res = ParseFloat(res, 3);
    return res;
};
export const getTokenSymbol = (symbol) => {
    const tokenList = mainToken;
    let tokenIcon = tokenList.tokens.find(token => token.symbol === symbol);
    if (!tokenIcon) {
        return TokenLogo;
    }
    return tokenIcon.logoURI;
};
const useAccountHistory = (socket) => {
    const { account, chainId, library } = useActiveWeb3React();
    const [loading, setLoading] = useState(false);
    const [historyData, setHistoryData] = useState({});
    const [stateAccount, setStateAccount] = useState(account);
    const [locationData, setLocationData] = useState("swap");
    const [URL, setURL] = useState("https://autoswap-server.herokuapp.com"); //
    const dispatch = useDispatch();
    const [contractAddress, setContractAddress] = useState(SMARTSWAPROUTER[chainId]);
    const tokenList = async (addressName) => {
        const token = await getERC20Token(addressName, library);
        const name = token.name();
        const symbol = token.symbol();
        const { address } = token;
        const decimals = token.decimals();
        const standardToken = await Promise.all([name, symbol, address, decimals]);
        const resolveToken = {
            name: standardToken[0],
            symbol: standardToken[1],
            address: standardToken[2],
            decimals: standardToken[3]
        };
        return address !== '0x' ? resolveToken : null;
    };
    function decodeInput(input, ABI) {
        abiDecoder.addABI(ABI);
        let decoder = abiDecoder.decodeMethod(input);
        return decoder;
    }
    const refreshPage = useSelector((state) => state.transactions.refresh);
    const location = useLocation().pathname;
    const [, Symbol, Name,] = useNativeBalance();
    useEffect(() => {
        if (location.includes("autotrade")) {
            setLocationData("auto");
            setStateAccount(AUTOSWAPSTATEADDRESSES[chainId]);
            let market = location.split("/").length >= 3 ? location.split("/")[2].charAt(0).toUpperCase() + location.split("/")[2].slice(1) : chainId === 43114 ? "Tradejoe" : "Pancakeswap";
            console.log({ market });
            setContractAddress(MARKETAUTOSWAPADDRESSES[market][chainId]);
        }
        else if (location.includes("set-price")) {
            setLocationData("price");
            setStateAccount(AUTOSWAPSTATEADDRESSES[chainId]);
            let market = location.split("/").length >= 3 ? location.split("/")[2].charAt(0).toUpperCase() + location.split("/")[2].slice(1) : chainId === 43114 ? "Tradejoe" : "Pancakeswap";
            console.log({ market });
            setContractAddress(MARKETAUTOSWAPADDRESSES[market][chainId]);
        }
        else if (location.includes("freeswap")) {
            setLocationData("freeswap");
            setStateAccount(account);
            let market = location.split("/").length >= 3 ? location.split("/")[2].charAt(0).toUpperCase() + location.split("/")[2].slice(1) : chainId === 43114 ? "Tradejoe" : "Pancakeswap";
            console.log({ market });
            console.log(MARKETFREESWAPADDRESSES[market][chainId], market);
            setContractAddress(MARKETFREESWAPADDRESSES[market][chainId]);
        }
        else {
            setLocationData("swap");
            setStateAccount(account);
            setContractAddress(SMARTSWAPROUTER[chainId]);
        }
        loadAccountHistory();
    }, [chainId, account, location, contractAddress, refreshPage, locationData]);
    useEffect(() => {
        socket?.on("success", () => {
            loadAccountHistory();
        });
        socket?.on("cleared", (page) => {
            if (page === "auto") {
                dispatch(notificationTab({ autoTimeNotification: 0 }));
            }
            else {
                dispatch(notificationTab({ setPriceNotification: 0 }));
            }
        });
    }, [socket]);
    const getTransactionFromDatabase = async (address) => {
        const data = await fetch(`${URL}/auto/data/all/${address}`);
        const trans = await fetch(`${URL}/auto`);
        const transaction = await data.json();
        const database = await trans.json();
        console.log({ database, transaction });
        return { transaction, database };
    };
    const api = APIENDPOINT[chainId];
    const apikey = APIKEY[chainId];
    const loadAccountHistory = async () => {
        if (account && locationData) {
            setLoading(true);
            try {
                let userData = [];
                if (location.includes("/swap")) {
                    const uri = `https://${api}?module=account&action=txlist&address=${account}&startblock=0
                &endblock=latest&sort=desc&apikey=${apikey}`;
                    const data = await fetch(uri);
                    const jsondata = await data.json();
                    const SwapTrx = jsondata.result.filter((item) => item.to == contractAddress);
                    const dataFiltered = SwapTrx
                        .filter((items) => decodeInput(items.input, SmartSwapRouter02) !== undefined) // && items.transactionHash !== "1"
                        .map((items) => ({
                        value: items.value,
                        transactionObj: decodeInput(items.input, SmartSwapRouter02).params,
                        timestamp: items.timeStamp,
                        transactionFee: items.gasPrice * items.gasUsed,
                        // name: decodeInput(items.input, locationData === "auto" ? AUTOSWAP : SmartSwapRouter02).name,
                        transactionHash: items.hash,
                        status: 10,
                        chainID: items.chainID,
                        market: "",
                        orderID: "",
                    }));
                    const dataToUse = dataFiltered.length > 5 ? dataFiltered.splice(0, 5) : dataFiltered;
                    userData = dataToUse.map((data) => ({
                        inputAmount: Number(data.value) > 0 ? data.value : data.transactionObj[0].value,
                        outputAmount: Number(data.value) > 0
                            ? data.transactionObj[0].value
                            : data.transactionObj[1].value,
                        tokenIn: Number(data.value) > 0
                            ? data.transactionObj[1].value[0]
                            : data.transactionObj[2].value[0],
                        tokenOut: Number(data.value) > 0
                            ? data.transactionObj[1].value[data.transactionObj[1].value.length - 1]
                            : data.transactionObj[2].value[data.transactionObj[2].value.length - 1],
                        time: timeConverter(data.timestamp),
                        // name: data.name,
                        frequency: "--",
                        id: "",
                        transactionHash: data.transactionHash,
                        error: [],
                        status: "10",
                        situation: "",
                        chainID: chainId,
                        market: "",
                        orderID: "",
                    }));
                }
                // else if(location.includes("freeswap")){
                //     const uri = `https://${api}?module=account&action=txlist&address=${FREESWAPACCOUNT[chainId ?? 56]}&startblock=0
                //     &endblock=latest&sort=desc&apikey=${apikey}`;
                //     const data = await fetch(uri);
                //     const jsondata = await data.json();
                //     const SwapTrx = jsondata.result.filter((item: any) => item.to.toLowerCase() == contractAddress.toLowerCase());
                //     console.log({SwapTrx,contractAddress,jsondata},FREESWAPACCOUNT[chainId ?? 56],)
                //     const dataFiltered = SwapTrx
                //     .filter((items: any) => decodeInput(items.input, FreeswapContract) !== undefined) 
                //     .map((items: any) => (
                //         {
                //         value: items.value,
                //         transactionObj: decodeInput(items.input, SmartSwapRouter02).params,
                //         timestamp: items.timeStamp,
                //         transactionFee: items.gasPrice * items.gasUsed,
                //         // name: decodeInput(items.input, locationData === "auto" ? AUTOSWAP : SmartSwapRouter02).name,
                //         transactionHash: items.hash,
                //         status: 10,
                //         chainID:items.chainID ,
                //         market:"",
                //         orderID:"",
                //     }));
                // const dataToUse = dataFiltered.length > 5 ? dataFiltered.splice(0, 5) : dataFiltered;
                // userData = dataToUse.map((data: any) => ({
                //     inputAmount:
                //         Number(data.value) > 0 ? data.value : data.transactionObj[3].value,
                //     outputAmount:
                //         Number(data.value) > 0
                //             ? data.transactionObj[0].value
                //             : data.transactionObj[1].value,
                //     tokenIn:
                //         Number(data.value) > 0
                //             ? data.transactionObj[1].value[0]
                //             : data.transactionObj[2].value[0],
                //     tokenOut:
                //         Number(data.value) > 0
                //             ? data.transactionObj[1].value[data.transactionObj[1].value.length - 1]
                //             : data.transactionObj[2].value[data.transactionObj[2].value.length - 1],
                //     time: timeConverter(data.timestamp),
                //     // name: data.name,
                //     frequency: "--",
                //     id: "",
                //     transactionHash: data.transactionHash,
                //     error: [],
                //     status: "10",
                //     situation:"",
                //     chainID:chainId,
                //     market:"",
                //     orderID:"",
                // }));
                // console.log({userData,dataToUse})
                // }
                else if (location.includes("autotrade") || location.includes("set-price")) {
                    const { transaction, database } = await getTransactionFromDatabase(account);
                    console.log({ transaction, database });
                    if (transaction.length > 0) {
                        dispatch(notificationTab({
                            autoTimeNotification: transaction[0].autoTimeNotification,
                            setPriceNotification: transaction[0].setPriceNotification,
                            address: transaction[0].address
                        }));
                        const collapsedTransaction = transaction[0].transaction;
                        let result = [];
                        if (locationData === "auto") {
                            result = collapsedTransaction.filter((data) => data.typeOfTransaction === "Auto Time");
                            // result = newArray
                        }
                        else if (locationData === "price") {
                            result = collapsedTransaction.filter((data) => data.typeOfTransaction === "Set Price");
                        }
                        result = result.filter((item) => (item.status === 1 || item.status === 0) && parseInt(item.chainID) === chainId).reverse();
                        userData = await Promise.all(result.map(async (data) => {
                            return {
                                inputAmount: data.amountToSwap,
                                outputAmount: data.typeOfTransaction === "Set Price" && data.status !== 1 ?
                                    parseFloat(data.percentageChange).toFixed(4) :
                                    data.typeOfTransaction === "Auto Time" && data.status !== 1 ?
                                        parseFloat(data.currentToPrice).toFixed(4) :
                                        parseFloat(data.actualToPrice).toFixed(4),
                                tokenIn: data.swapFromToken,
                                tokenOut: data.swapToToken,
                                time: data.time && timeConverter(parseInt(data.time)),
                                name: data ? data.typeOfTransaction : "",
                                frequency: data ? data.frequency : "--",
                                id: data ? data.id : "",
                                transactionHash: data.transactionHash,
                                error: data.errorArray,
                                status: data.status,
                                currentToPrice: data.typeOfTransaction === "Set Price" ? data.currentToPrice : data.percentageChange,
                                chainID: data.chainID,
                                orderID: data.orderID,
                                initialFromPrice: data.initialFromPrice,
                                initialToPrice: data.initialToPrice,
                                situation: data.situation,
                                pathSymbol: data.pathSymbol,
                                market: data.market,
                                totalTransaction: data.totalNumberOfTransaction
                            };
                        }));
                        console.log({ userData });
                    }
                }
                const swapDataForWallet = await Promise.all(userData.map(async (data) => ({
                    tokenIn: data.chainID && data.tokenIn === "native" ? {
                        name: SupportedChainName[data.chainID],
                        symbol: SupportedChainSymbols[data.chainID],
                        address: WNATIVEADDRESSES[chainId],
                        decimals: 18
                    } : await tokenList(data.tokenIn),
                    tokenOut: data.chainID && data.tokenOut === "native" ? {
                        name: SupportedChainName[data.chainID],
                        symbol: SupportedChainSymbols[data.chainID],
                        address: WNATIVEADDRESSES[chainId],
                        decimals: 18
                    } : await tokenList(data.tokenOut),
                    amountIn: data.inputAmount,
                    amountOut: data.outputAmount,
                    time: data.time,
                    name: data.name,
                    frequency: data.frequency,
                    id: data.id,
                    transactionHash: data.transactionHash,
                    error: data.error,
                    status: data.status,
                    currentToPrice: data.currentToPrice,
                    chainID: data.chainID,
                    initialFromPrice: data.initialFromPrice,
                    initialToPrice: data.initialToPrice,
                    situation: data.situation,
                    pathSymbol: data.pathSymbol,
                    market: data.market,
                    orderID: data.orderID,
                    totalTransaction: data.totalTransaction
                })));
                console.log({ swapDataForWallet });
                const userSwapHistory = swapDataForWallet.map((data) => ({
                    token1Icon: getTokenSymbol(data.tokenIn.symbol),
                    token2Icon: getTokenSymbol(data.tokenOut.symbol),
                    token1: data.tokenIn,
                    token2: data.tokenOut,
                    amountIn: data.tokenIn?.name === SupportedChainName[data.chainID] ? parseFloat(formatAmount(data.amountIn, data.tokenIn.decimals)) / data.totalTransaction : formatAmount(data.amountIn, data.tokenIn.decimals),
                    amountOut: data.name === "Set Price" || data.name === "Auto Time" ? data.amountOut :
                        formatAmount(data.amountOut, data.tokenOut.decimals),
                    time: data.time,
                    name: data.name,
                    frequency: data.frequency,
                    id: data.id,
                    transactionHash: data.transactionHash,
                    error: data.error,
                    status: data.status,
                    currentToPrice: data.currentToPrice,
                    chainID: data.chainID,
                    initialFromPrice: data.initialFromPrice,
                    initialToPrice: data.initialToPrice,
                    situation: data.situation,
                    pathSymbol: data.pathSymbol,
                    market: data.market,
                    orderID: data.orderID,
                }));
                console.log({ userSwapHistory });
                setHistoryData(userSwapHistory);
                setLoading(false);
            }
            catch (e) {
                console.log(e);
                setLoading(false);
                setHistoryData({});
            }
        }
        else {
            console.log('Wallet disconnected');
        }
    };
    return { historyData, loading, locationData };
};
export default useAccountHistory;
