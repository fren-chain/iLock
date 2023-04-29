import { useCombinedActiveList } from "../state/lists/hooks";
import { Token } from "@uniswap/sdk-core";
import { useUserAddedTokens } from "../state/user/hooks";
import { useActiveWeb3React } from "../utils/hooks/useActiveWeb3React";
import { useState, useEffect, useMemo } from "react";
import { isAddress } from "../utils";
import { getERC20Token } from "../utils/utilsFunctions";
import { useNativeBalance } from "../utils/hooks/useBalances";
import { useCombinedInactiveList } from "../state/lists/hooks";
import { useSelector } from "react-redux";
// reduce token map into standard address <-> Token mapping, optionally include user added tokens
function useTokensFromMap(tokenMap, includeUserAdded) {
    const { chainId, account } = useActiveWeb3React();
    const ChainId = useSelector((state) => state.chainId.chainId);
    const userAddedTokens = useUserAddedTokens();
    return useMemo(() => {
        if (!ChainId) {
            return {};
        }
        // reduce to just tokens
        const mapWithoutUrls = Object.keys(tokenMap[ChainId] ?? {}).reduce((newMap, address) => {
            newMap[address] = tokenMap[ChainId][address].token;
            return newMap;
        }, {});
        if (includeUserAdded && account) {
            return (userAddedTokens
                // reduce into all ALL_TOKENS filtered by the current chain
                .reduce((tokenMap, token) => {
                tokenMap[token.address] = token;
                return tokenMap;
            }, 
            // must make a copy because reduce modifies the map, and we do not
            // want to make a copy in every iteration
            { ...mapWithoutUrls }));
        }
        return mapWithoutUrls;
    }, [ChainId, tokenMap, includeUserAdded]);
}
export function useAllTokens() {
    const allTokens = useCombinedActiveList();
    return useTokensFromMap(allTokens, true);
}
export const ExtendedEther = (chainId = 56, symbol, name, logo) => {
    let native = {
        chainId: chainId,
        decimals: 18,
        isNative: true,
        isToken: false,
        name,
        symbol,
        logoURI: logo,
    };
    return native;
};
export function useIsTokenActive(token) {
    const activeTokens = useAllTokens();
    if (!activeTokens || !token) {
        return false;
    }
    return !!activeTokens[token.address];
}
export function useAllInactiveTokens() {
    // get inactive tokens
    const inactiveTokensMap = useCombinedInactiveList();
    const inactiveTokens = useTokensFromMap(inactiveTokensMap, false);
    // filter out any token that are on active list
    const activeTokensAddresses = Object.keys(useAllTokens());
    const filteredInactive = activeTokensAddresses
        ? Object.keys(inactiveTokens).reduce((newMap, address) => {
            if (!activeTokensAddresses.includes(address)) {
                newMap[address] = inactiveTokens[address];
            }
            return newMap;
        }, {})
        : inactiveTokens;
    return filteredInactive;
}
// Check if currency is included in custom list from user storage
export function useIsUserAddedToken(currency) {
    const userAddedTokens = useUserAddedTokens();
    if (!currency) {
        return false;
    }
    return !!userAddedTokens.find((token) => {
        if (token && currency && !currency.isNative) {
            return currency.address === token.address &&
                currency.chainId === token.chainId
                ? true
                : false;
        }
    });
}
export function useToken(tokenAddress) {
    const { chainId, library } = useActiveWeb3React();
    const tokens = useAllTokens();
    const [token, setToken] = useState();
    useEffect(() => {
        const getToken = async (tokenAddress, chainId) => {
            const address = isAddress(tokenAddress);
            const token = address ? tokens[address] : undefined;
            try {
                if (token)
                    setToken(token);
                if (!chainId || !address)
                    setToken(undefined);
                if (address && !tokens[address]) {
                    const tokenContract = await getERC20Token(address, library);
                    const name = await tokenContract.name();
                    const tokenDecimal = await tokenContract.decimals();
                    const tokenSymbol = await tokenContract.symbol();
                    let newToken = new Token(chainId, address, tokenDecimal, tokenSymbol, name);
                    setToken(newToken);
                }
            }
            catch (e) {
                console.log("no Token found");
            }
            // setToken(undefined)
        };
        getToken(tokenAddress, chainId ?? 56);
    }, [tokenAddress, chainId]);
    return token;
    // 0x03fF0ff224f904be3118461335064bB48Df47938
}
export function useCurrency(currencyId) {
    const [, Symbol, Name, Logo] = useNativeBalance();
    const { chainId } = useActiveWeb3React();
    const isNative = currencyId?.toUpperCase() === Symbol;
    const token = useToken(isNative ? undefined : currencyId);
    return isNative
        ? chainId && ExtendedEther(chainId, Symbol, Name, Logo)
        : token;
}
