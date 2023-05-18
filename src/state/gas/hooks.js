import { useMemo, useCallback } from "react";
import { useWeb3React } from "@web3-react/core";
import { useDispatch, useSelector } from "react-redux";
import { updateUserGasPrice, setDefaultGasPrice } from "./action";
import { INITIAL_GASPRICE_INCREASE } from "../../utils/constants";
export function useUserGasPricePercentage() {
    const dispatch = useDispatch();
    const userGasPricePercentage = useSelector((state) => {
        return state.gas.userGasPrice;
    });
    const setUserGasPricePercentage = useCallback((GasPercentage) => {
        dispatch(updateUserGasPrice({ userGasPrice: GasPercentage }));
    }, [dispatch]);
    return [userGasPricePercentage, setUserGasPricePercentage];
}
export const useUpdateUserGasPreference = () => {
    const { chainId } = useWeb3React();
    const dispatch = useDispatch();
    const changed = useSelector((state) => {
        return state.gas.changed;
    });
    const setDefaultGasPriceForNetworks = useCallback((percent) => {
        dispatch(setDefaultGasPrice({ userGasPrice: percent }));
    }, [dispatch]);
    useMemo(() => {
        if (chainId) {
            if (chainId === 137 && !changed) {
                setDefaultGasPriceForNetworks(INITIAL_GASPRICE_INCREASE());
            }
            else if (chainId !== 137 && !changed) {
                setDefaultGasPriceForNetworks(INITIAL_GASPRICE_INCREASE());
            }
        }
    }, [chainId]);
};
