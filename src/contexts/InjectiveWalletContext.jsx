import { createContext, useCallback, useContext, useMemo, useState, } from "react";
import { Wallet, WalletStrategy } from "@injectivelabs/wallet-ts";
import { ChainId } from "@injectivelabs/ts-types";
import keplrIcon from "../icons/keplr.svg";
const InjectiveProviderContext = createContext({
    connect: (wallet) => { },
    disconnect: () => { },
    wallet: null,
    address: null,
});
export const SUPPORTED_WALLETS = [
    {
        wallet: Wallet.Keplr,
        name: "Keplr",
        isInstalled: typeof window.keplr !== "undefined",
        icon: keplrIcon,
        url: "https://chrome.google.com/webstore/detail/keplr/dmkamcknogkgcdfhhbddcghachkejeap",
    },
];
export const InjectiveWalletProvider = ({ children, }) => {
    const [wallet, setWallet] = useState(null);
    const [address, setAddress] = useState(null);
    const connect = useCallback((walletType) => {
        let cancelled = false;
        (async () => {
            try {
                // WalletStrategy notes:
                // Keplr wallet doesn't support changing accounts, getting the network or chain id
                // MetaMask wallet can only sign injective TXs if the active chain is the same as the one passed to the WalletStrategy
                const wallet = new WalletStrategy({
                    chainId: ChainId.Testnet,
                    // WalletStrategy throws when WalletConnect is enabled
                    disabledWallets: [Wallet.WalletConnect],
                });
                wallet.setWallet(walletType);
                const addresses = await wallet.getAddresses();
                if (addresses.length === 0) {
                    throw new Error("There are no addresses linked to this wallet.");
                }
                const address = addresses[0];
                if (!cancelled) {
                    setWallet(wallet);
                    setAddress(address);
                }
            }
            catch (e) {
                console.error(e);
                if (!cancelled) {
                    setWallet(null);
                    setAddress(null);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);
    const disconnect = useCallback(() => {
        let cancelled = false;
        (async () => {
            try {
                await wallet?.disconnectWallet();
            }
            catch (e) {
                console.error(e);
            }
            if (!cancelled) {
                setWallet(null);
                setAddress(null);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [wallet]);
    const contextValue = useMemo(() => ({
        connect,
        disconnect,
        wallet,
        address,
    }), [connect, disconnect, wallet, address]);
    return (<InjectiveProviderContext.Provider value={contextValue}>
      {children}
    </InjectiveProviderContext.Provider>);
};
export default InjectiveWalletProvider;
export const useInjectiveContext = () => {
    return useContext(InjectiveProviderContext);
};
