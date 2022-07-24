import "../styles/globals.css";
import { ChakraProvider } from "@chakra-ui/react";
import "react-icons/hi";
import "react-icons/fi";
import "react-icons/ai";
import { configureChains, chain, createClient, WagmiConfig } from "wagmi";
import { alchemyProvider } from "wagmi/providers/alchemy";
import { InjectedConnector } from "wagmi/connectors/injected";
import ApolloContextProvider from "../context/ApolloContext";

const { chains, provider } = configureChains(
    [chain.polygonMumbai],
    [alchemyProvider({ alchemyId: "ix7RnbB3JaXzJhQqYQnE6EeqmB78Qf2u" })]
);

const wagmiClient = createClient({
    autoConnect: true,
    connectors: [new InjectedConnector({ chains })],
    provider,
});

function MyApp({ Component, pageProps }) {
    return (
        <WagmiConfig client={wagmiClient}>
            <ApolloContextProvider>
                <ChakraProvider>
                    <Component {...pageProps} />
                </ChakraProvider>
            </ApolloContextProvider>
        </WagmiConfig>
    );
}

export default MyApp;
