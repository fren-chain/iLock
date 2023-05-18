import { SupportedChainId } from '../constants/chains';
const ETHERSCAN_PREFIXES = {
    //[SupportedChainId.MAINNET]: '',
    [SupportedChainId.ROPSTEN]: 'ropsten.',
    [SupportedChainId.RINKEBY]: 'rinkeby.',
    [SupportedChainId.GOERLI]: 'goerli.',
    [SupportedChainId.KOVAN]: 'kovan.',
    [SupportedChainId.POLYGON]: 'polygon.',
    [SupportedChainId.BINANCE]: 'binance.',
    [SupportedChainId.BINANCETEST]: 'binance-test.',
    [SupportedChainId.POLYGONTEST]: 'polygon-test.',
};
export var ExplorerDataType;
(function (ExplorerDataType) {
    ExplorerDataType["TRANSACTION"] = "transaction";
    ExplorerDataType["TOKEN"] = "token";
    ExplorerDataType["ADDRESS"] = "address";
    ExplorerDataType["BLOCK"] = "block";
})(ExplorerDataType || (ExplorerDataType = {}));
/**
 * Return the explorer link for the given data and data type
 * @param chainId the ID of the chain for which to return the data
 * @param data the data to return a link for
 * @param type the type of the data
 */
export function getExplorerLink(chainId, data, type) {
    if (chainId === SupportedChainId.POLYGON) {
        switch (type) {
            case ExplorerDataType.TRANSACTION:
                return `https://polygonscan.com/tx/${data}`;
            case ExplorerDataType.ADDRESS:
            case ExplorerDataType.TOKEN:
                return `https://polygonscan.com/address/${data}`;
            case ExplorerDataType.BLOCK:
                return `https://polygonscan.com/block/${data}`;
            default:
                return `https://polygonscan.com`;
        }
    }
    if (chainId === SupportedChainId.AVALANCHE) {
        switch (type) {
            case ExplorerDataType.TRANSACTION:
                return `https://snowtrace.io/tx/${data}`;
            case ExplorerDataType.ADDRESS:
            case ExplorerDataType.TOKEN:
                return `https://snowtrace.io/address/${data}`;
            case ExplorerDataType.BLOCK:
                return `https://snowtrace.io/block/${data}`;
            default:
                return `https://snowtrace.io`;
        }
    }
    if (chainId === SupportedChainId.POLYGONTEST) {
        switch (type) {
            case ExplorerDataType.TRANSACTION:
                return `https://mumbai.polygonscan.com/tx/${data}`;
            case ExplorerDataType.ADDRESS:
            case ExplorerDataType.TOKEN:
                return `https://mumbai.polygonscan.com/address/${data}`;
            case ExplorerDataType.BLOCK:
                return `https://mumbai.polygonscan.com/block/${data}`;
            default:
                return `https://mumbai.polygonscan.com`;
        }
    }
    if (chainId === SupportedChainId.BINANCE) {
        switch (type) {
            case ExplorerDataType.TRANSACTION:
                return `https://www.bscscan.com/tx/${data}`;
            case ExplorerDataType.ADDRESS:
            case ExplorerDataType.TOKEN:
                return `https://www.bscscan.com/address/${data}`;
            case ExplorerDataType.BLOCK:
                return `https://www.bscscan.com/block/${data}`;
            default:
                return `https://www.bscscan.com`;
        }
    }
    if (chainId === SupportedChainId.BINANCETEST) {
        switch (type) {
            case ExplorerDataType.TRANSACTION:
                return `https://testnet.bscscan.com/tx/${data}`;
            case ExplorerDataType.ADDRESS:
            case ExplorerDataType.TOKEN:
                return `https://testnet.bscscan.com/address/${data}`;
            case ExplorerDataType.BLOCK:
                return `https://testnet.bscscan.com/block/${data}`;
            default:
                return `https://testnet.bscscan.com`;
        }
    }
    const prefix = `https://${ETHERSCAN_PREFIXES[chainId] ?? ''}etherscan.io`;
    switch (type) {
        case ExplorerDataType.TRANSACTION:
            return `${prefix}/tx/${data}`;
        case ExplorerDataType.TOKEN:
            return `${prefix}/token/${data}`;
        case ExplorerDataType.BLOCK:
            if (chainId === SupportedChainId.GOERLI ||
                chainId === SupportedChainId.ROPSTEN ||
                chainId === SupportedChainId.KOVAN ||
                chainId === SupportedChainId.RINKEBY) {
                return `${prefix}/tx/${data}`;
            }
            return `${prefix}/block/${data}`;
        case ExplorerDataType.ADDRESS:
            return `${prefix}/address/${data}`;
        default:
            return `${prefix}`;
    }
}
