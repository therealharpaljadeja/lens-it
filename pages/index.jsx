import {
    Heading,
    useDisclosure,
    HStack,
    Grid,
    VStack,
    Button,
    Avatar,
    Tag,
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalFooter,
    ModalBody,
    ModalCloseButton,
    Textarea,
    Input,
    Image,
    Box,
    Text,
} from "@chakra-ui/react";
import {
    useAccount,
    useConnect,
    useDisconnect,
    useNetwork,
    useProvider,
    useSigner,
    useSwitchNetwork,
} from "wagmi";
import { InjectedConnector } from "@wagmi/core";
import { useState, useEffect, useContext } from "react";
import { ApolloContext } from "../context/ApolloContext";
import LitJsSdk, { disconnectWeb3 } from "lit-js-sdk";
import { uploadIpfs } from "../ipfs";
import { v4 as uuidv4 } from "uuid";
import toast, { Toaster } from "react-hot-toast";
import dynamic from "next/dynamic";
import omitDeep from "omit-deep";
import { ethers } from "ethers";
import { LENS_HUB_ABI } from "../abi";
import { Interweave } from "interweave";
import { FiUnlock } from "react-icons/fi";
import { AiOutlineDisconnect } from "react-icons/ai";
import { HiLockClosed, HiLockOpen } from "react-icons/hi";
import axios from "axios";

const trimify = (value) => value?.replace(/\n\s*\n/g, "\n").trim();

const Card = dynamic(() => import("../components/Card"), { ssr: false });

export default function Home() {
    const { connect } = useConnect({
        connector: new InjectedConnector(),
    });

    const { chain } = useNetwork();
    const {
        chains,
        error,
        isLoading: isChainLoading,
        pendingChainId,
        switchNetwork,
        status,
    } = useSwitchNetwork({
        chainId: 80001,
    });
    const { isOpen, onOpen, onClose } = useDisclosure();
    const [evmContractConditions, setevmContractConditions] = useState([]);
    const [isPublishing, setIsPublishing] = useState(false);
    const [authSig, setAuthSig] = useState(undefined);
    const [content, setContent] = useState("");
    const [allowHandle, setAllowHandle] = useState("");
    const { data: signer } = useSigner();
    const [allowHandles, setAllowHandles] = useState({});
    const { address, connector, isConnecting, isDisconnected } = useAccount();
    const [feedPublications, setFeedPublications] = useState([]);
    const { disconnect: disconnectWallet } = useDisconnect();
    const [isDecrypting, setIsDecrypting] = useState(false);
    const {
        apolloContext,
        clearState,
        getProfileIdByHandle,
        createPostTypedData,
        explorePublications,
    } = useContext(ApolloContext);
    const { profiles, currentProfile } = apolloContext;
    const [isContentInvalid, setIsContentInvalid] = useState(false);
    const provider = useProvider();

    async function connectToLit() {
        await LitJsSdk.signAndSaveAuthMessage({
            provider,
            account: address,
            chainId: (await provider.getNetwork()).chainId,
        });
        let authSig = localStorage.getItem("lit-auth-signature");
        console.log(JSON.parse(authSig));
        setAuthSig(JSON.parse(authSig));
    }

    function blobToDataURL(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (_e) => resolve(reader.result);
            reader.onerror = (_e) => reject(reader.error);
            reader.onabort = (_e) => reject(new Error("Read aborted"));
            reader.readAsDataURL(blob);
        });
    }

    async function encrypt() {
        setIsPublishing(true);
        try {
            if (content.length > 0) {
                const { encryptedString, symmetricKey } =
                    await LitJsSdk.encryptString(content);
                await uploadToLit(symmetricKey, encryptedString);
            } else {
                setIsContentInvalid(true);
            }
        } catch (e) {
            toast.error(e);
        }
    }

    async function uploadToLit(symmetricKey, encryptedString) {
        if (evmContractConditions.length > 0) {
            console.log(evmContractConditions);
            const encryptedSymmetricKey =
                await window.litNodeClient.saveEncryptionKey({
                    evmContractConditions,
                    symmetricKey,
                    authSig,
                    chain: "mumbai",
                });

            uploadDecryptionDataToIpfs(
                encryptedString,
                encryptedSymmetricKey,
                evmContractConditions
            );
        } else {
            toast.error("No Access Control Conditions");
        }
    }

    async function uploadDecryptionDataToIpfs(
        encryptedString,
        encryptedSymmetricKey,
        evmContractConditions
    ) {
        let encryptedData = await blobToDataURL(encryptedString);

        const packagedData = JSON.stringify({
            encryptedData,
            encryptedSymmetricKey,
            evmContractConditions,
        });

        console.log(`packagedData encrypting: ${packagedData}`);

        let result = await uploadIpfs(packagedData);
        console.log(
            `Encrypted Content link: https://ipfs.infura.io/ipfs/${result.path}`
        );
        let allowedHandles = Object.values(allowHandles).map((handle) => {
            return `@${handle.handle}`;
        });

        const objectToUpload = {
            version: "1.0.0",
            appId: "lens-it-working",
            content: `${encryptedData} \n\n This post is encrypted and only viewable by ${allowedHandles.join(
                ", "
            )}`,
            attributes: [
                {
                    traitType: "content_location",
                    value: `ipfs://${result.path}`,
                },
            ],
            name: `Published by ${[profiles[currentProfile].handle]}`,
            description:
                "This post is encrypted and only viewable by a specific set of handles",
            metadata_id: uuidv4(),
        };

        let objectResult = await uploadIpfs(objectToUpload);
        console.log(objectResult.path);
        await uploadToLens(objectResult.path);
    }

    async function uploadToLens(path) {
        const createPostRequest = {
            profileId: profiles[currentProfile].id,
            contentURI: `ipfs://${path}`,
            collectModule: {
                revertCollectModule: true,
            },
            referenceModule: {
                followerOnlyReferenceModule: false,
            },
        };

        const result = await createPostTypedData(createPostRequest);

        const typedData = result.data.createPostTypedData.typedData;
        console.log(signer);
        const signature = await signer._signTypedData(
            omitDeep(typedData.domain, "__typename"),
            omitDeep(typedData.types, "__typename"),
            omitDeep(typedData.value, "__typename")
        );

        const { v, r, s } = ethers.utils.splitSignature(signature);
        const lensHub = new ethers.Contract(
            "0x60Ae865ee4C725cd04353b5AAb364553f56ceF82",
            LENS_HUB_ABI,
            signer
        );

        const tx = await lensHub.postWithSig({
            profileId: typedData.value.profileId,
            contentURI: typedData.value.contentURI,
            collectModule: typedData.value.collectModule,
            collectModuleInitData: typedData.value.collectModuleInitData,
            referenceModule: typedData.value.referenceModule,
            referenceModuleInitData: typedData.value.referenceModuleInitData,
            sig: {
                v,
                r,
                s,
                deadline: typedData.value.deadline,
            },
        });
        setIsPublishing(false);
        onClose();
        setContent("");
        setAllowHandles([]);
        setevmContractConditions([]);
        setAllowHandle("");
        console.log("create post: tx hash", tx.hash);
    }

    function addLensHandleToAccessControl(tokenId) {
        const conditions = {
            contractAddress: "0x60Ae865ee4C725cd04353b5AAb364553f56ceF82",
            functionName: "ownerOf",
            functionParams: [tokenId],
            functionAbi: {
                inputs: [
                    {
                        internalType: "uint256",
                        name: "tokenId",
                        type: "uint256",
                    },
                ],
                name: "ownerOf",
                outputs: [
                    {
                        internalType: "address",
                        name: "",
                        type: "address",
                    },
                ],
                stateMutability: "view",
                type: "function",
            },
            chain: "mumbai",
            returnValueTest: {
                key: "",
                comparator: "=",
                value: ":userAddress",
            },
        };

        return conditions;
    }

    async function modfifyAccessControl(handle) {
        let response = await getProfileIdByHandle({ handle });
        if (response.data.profile) {
            let tokenId = Number(response.data.profile.id).toString();
            if (
                allowHandles[tokenId] !== undefined &&
                allowHandles[tokenId].allowed
            ) {
                toast.error("Handle Already allowed");
            } else {
                setAllowHandles({
                    ...allowHandles,
                    [tokenId]: { allowed: 1, handle },
                });
                console.log(allowHandles);
                let evmContractConditionsModified = evmContractConditions;
                if (evmContractConditionsModified.length == 0) {
                    evmContractConditionsModified.push(
                        addLensHandleToAccessControl(tokenId)
                    );
                } else {
                    evmContractConditionsModified.push({ operator: "or" });
                    evmContractConditionsModified.push(
                        addLensHandleToAccessControl(tokenId)
                    );
                }
                setevmContractConditions(evmContractConditionsModified);
            }
        } else {
            toast.error("Non existent handle!");
        }
    }

    function dataURLtoBlob(dataurl) {
        var arr = dataurl.split(","),
            mime = arr[0].match(/:(.*?);/)[1],
            bstr = atob(arr[1]),
            n = bstr.length,
            u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    }

    async function decrypt(index, contentUrl) {
        setIsDecrypting(true);
        let data;
        let response;
        try {
            response = await axios.get(ipfsGatewaytoHTTPS(contentUrl));
        } catch (err) {
            console.log(err);
            toast.error(err.message);
        }

        if (response) {
            data = response.data;
            let parsedData = JSON.parse(data);
            const chain = "mumbai";
            let {
                encryptedSymmetricKey,
                encryptedData,
                evmContractConditions,
            } = parsedData;

            try {
                const symmetricKey =
                    await window.litNodeClient.getEncryptionKey({
                        evmContractConditions,
                        toDecrypt: LitJsSdk.uint8arrayToString(
                            new Uint8Array(
                                Object.values(encryptedSymmetricKey)
                            ),
                            "base16"
                        ),
                        chain,
                        authSig,
                    });

                const decryptedString = await LitJsSdk.decryptString(
                    dataURLtoBlob(encryptedData),
                    symmetricKey
                );

                let modifiedFeedPublications = [...feedPublications];
                modifiedFeedPublications[index]["decrypted"] = true;
                modifiedFeedPublications[index]["decryptedContent"] =
                    decryptedString;
                setFeedPublications(modifiedFeedPublications);
            } catch (error) {
                toast.error(error.message);
            } finally {
                setIsDecrypting(false);
            }
        }
    }

    function ipfsGatewaytoHTTPS(url) {
        return `https://ipfs.infura.io/ipfs/${url.substr(7)}`;
    }

    useEffect(() => {
        if (connector) connector.on("change", () => disconnect());
    }, [connector]);

    useEffect(() => {
        async function connectToLitNetwork() {
            const client = new LitJsSdk.LitNodeClient();
            await client.connect();
            window.litNodeClient = client;
            console.log("lit client ready");
        }
        if (connector) {
            connector.on("change", () => disconnect());
        }
        let authSig = localStorage.getItem("lit-auth-signature");
        console.log(authSig);
        if (authSig !== null) {
            console.log(JSON.parse(authSig));
            setAuthSig(JSON.parse(authSig));
            connectToLitNetwork();
        }

        async function getLensItPublications() {
            let response = await explorePublications();
            setFeedPublications(
                response.data.explorePublications.items.map((pub) => {
                    return {
                        id: pub.id,
                        profile: pub.profile,
                        metadata: pub.metadata,
                    };
                })
            );
        }
        getLensItPublications();
    }, []);

    useEffect(() => {
        async function switchToCorrectNetwork() {
            if (chain) {
                if (chain.id != chains[0].id) {
                    switchNetwork();
                }
            }
        }
        if (switchNetwork) {
            switchToCorrectNetwork();
        }
    }, [chain]);

    async function disconnect() {
        disconnectWeb3();
        localStorage.clear("lensAPIRefreshToken");
        localStorage.clear("lensAPIAccessToken");
        setAuthSig(undefined);
        clearState();
        disconnectWallet();
        clearState();
    }

    return (
        <VStack
            alignItems="flex-start"
            maxHeight="100vh"
            background="whiteAlpha"
            padding="4"
            overflow="hidden"
        >
            <Toaster position="bottom-right" />
            <Modal isOpen={isOpen} onClose={onClose}>
                <ModalOverlay />
                <ModalContent>
                    <ModalHeader>Publish an Encrypted Post</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                        <VStack spacing={4} alignItems="flex-start">
                            <Heading size="sm" color="gray.800">
                                Post Content
                            </Heading>
                            <Textarea
                                value={content}
                                isInvalid={isContentInvalid}
                                onChange={(e) => {
                                    if (content.length == 0) {
                                        setIsContentInvalid(false);
                                    }
                                    setContent(e.target.value);
                                }}
                                height="200px"
                            />
                            <>
                                <Heading size="sm" color="gray.800">
                                    Allow handle to decrypt
                                </Heading>
                                <HStack width="100%">
                                    <Input
                                        value={allowHandle}
                                        onChange={(e) =>
                                            setAllowHandle(e.target.value)
                                        }
                                    />
                                    <Button
                                        onClick={() =>
                                            modfifyAccessControl(allowHandle)
                                        }
                                        colorScheme="blue"
                                    >
                                        Add
                                    </Button>
                                </HStack>
                            </>
                            <VStack>
                                <Heading size="sm" color="gray.800">
                                    Handle which can decrypt this post
                                </Heading>
                                <HStack
                                    justifyContent="flex-start"
                                    width="100%"
                                >
                                    {Object.keys(allowHandles).map((token) => {
                                        return (
                                            <Tag size="lg" key={token}>
                                                {allowHandles[token].handle}
                                            </Tag>
                                        );
                                    })}
                                </HStack>
                            </VStack>
                        </VStack>
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            onClick={encrypt}
                            width="100%"
                            colorScheme="pink"
                            isLoading={isPublishing}
                        >
                            Publish
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
            <VStack
                width="100%"
                style={{ marginBottom: "20px" }}
                justifyContent="center"
            >
                <Heading>LensIT</Heading>
                <Heading size="md">
                    Make Private Publications on Lens Protocol using Lit
                    Protocol
                </Heading>
            </VStack>
            <Grid
                gridGap={"10"}
                templateColumns="repeat(12, 1fr)"
                px="90"
                width="100%"
                overflow="auto"
            >
                <VStack
                    gridColumnStart={1}
                    overflowY="scroll"
                    className="scrollbar-hidden"
                    gridColumnEnd={10}
                >
                    {feedPublications.length > 0 ? (
                        <>
                            {feedPublications.map((pub, index) => {
                                return (
                                    <Card key={pub.id} width="100%">
                                        <HStack
                                            spacing="4"
                                            alignItems="flex-start"
                                            width="100%"
                                        >
                                            {pub.decrypted ? (
                                                <>
                                                    <Box h="40px" w="40px">
                                                        <Image
                                                            src={`https://avatar.tobi.sh/${pub.profile?.ownedBy}_${pub.profile?.handle}.png`}
                                                            size="sm"
                                                            borderRadius="full"
                                                        />
                                                    </Box>
                                                    <VStack
                                                        width="100%"
                                                        alignItems="flex-start"
                                                    >
                                                        <HStack
                                                            width="100%"
                                                            justifyContent="space-between"
                                                        >
                                                            <VStack>
                                                                <Heading size="md">
                                                                    {pub.profile
                                                                        .name
                                                                        ? pub
                                                                              .profile
                                                                              .name
                                                                        : pub
                                                                              .profile
                                                                              .handle}
                                                                </Heading>
                                                                <Heading
                                                                    size="sm"
                                                                    style={{
                                                                        marginBottom:
                                                                            "12px",
                                                                    }}
                                                                >{`@${pub.profile.handle}`}</Heading>
                                                            </VStack>
                                                            <Heading size="sm">
                                                                <a
                                                                    href={`https://ipfs.infura.io/ipfs/${pub.metadata.attributes[0].value.substr(
                                                                        7
                                                                    )}`}
                                                                >
                                                                    View on IPFS
                                                                </a>
                                                            </Heading>
                                                        </HStack>
                                                        <Interweave
                                                            content={trimify(
                                                                pub.decryptedContent
                                                            )}
                                                        />
                                                    </VStack>
                                                </>
                                            ) : (
                                                <>
                                                    <Box h="40px" w="40px">
                                                        <Image
                                                            src={`https://avatar.tobi.sh/${pub.profile?.ownedBy}_${pub.profile?.handle}.png`}
                                                            size="sm"
                                                            borderRadius="full"
                                                        />
                                                    </Box>
                                                    <VStack
                                                        width="100%"
                                                        alignItems="flex-start"
                                                    >
                                                        <HStack
                                                            width="100%"
                                                            justifyContent="space-between"
                                                        >
                                                            <VStack>
                                                                <Heading size="md">
                                                                    {pub.profile
                                                                        .name
                                                                        ? pub
                                                                              .profile
                                                                              .name
                                                                        : pub
                                                                              .profile
                                                                              .handle}
                                                                </Heading>
                                                                <Heading
                                                                    size="sm"
                                                                    style={{
                                                                        marginBottom:
                                                                            "12px",
                                                                    }}
                                                                >{`@${pub.profile.handle}`}</Heading>
                                                            </VStack>
                                                            <Heading size="sm">
                                                                <a
                                                                    href={`https://ipfs.infura.io/ipfs/${pub.metadata.attributes[0].value.substr(
                                                                        7
                                                                    )}`}
                                                                >
                                                                    View on IPFS
                                                                </a>
                                                            </Heading>
                                                        </HStack>
                                                        <Interweave
                                                            content={trimify(
                                                                pub.metadata
                                                                    .content
                                                            )}
                                                        />
                                                        {authSig && (
                                                            <Button
                                                                leftIcon={
                                                                    <HiLockOpen />
                                                                }
                                                                colorScheme="pink"
                                                                mt="6 !important"
                                                                variant="outline"
                                                                isLoading={
                                                                    isDecrypting
                                                                }
                                                                onClick={(e) =>
                                                                    decrypt(
                                                                        index,
                                                                        pub
                                                                            .metadata
                                                                            .attributes[0]
                                                                            .value
                                                                    )
                                                                }
                                                            >
                                                                Decrypt
                                                            </Button>
                                                        )}
                                                    </VStack>
                                                </>
                                            )}
                                        </HStack>
                                    </Card>
                                );
                            })}
                        </>
                    ) : (
                        <Card>
                            <Heading size="md">No Posts</Heading>
                        </Card>
                    )}
                </VStack>
                <VStack gridColumnStart={10} gridColumnEnd={13}>
                    {profiles &&
                        profiles.length > 0 &&
                        currentProfile !== undefined && (
                            <VStack
                                border="1px solid"
                                boxShadow="md"
                                borderColor="gray.400"
                                borderRadius="md"
                                w="100%"
                                overflow="hidden"
                            >
                                <Box
                                    // bgImage="/tile_background.png"
                                    className="pattern-bg"
                                    w="100%"
                                    h="100px"
                                ></Box>
                                <VStack padding={4} justifyContent="center">
                                    <Box
                                        position="absolute"
                                        border="5px solid white"
                                        mt="-180px"
                                        borderRadius="md"
                                        w="80px"
                                        overflow="hidden"
                                    >
                                        <Image
                                            h="100%"
                                            w="100%"
                                            borderRadius="md"
                                            src={`https://avatar.tobi.sh/${profiles[currentProfile].ownedBy}_${profiles[currentProfile].handle}.png`}
                                        />
                                    </Box>
                                    <Text
                                        fontWeight="600"
                                        marginTop="35px !important"
                                    >
                                        {`@${profiles[currentProfile].handle}`}
                                    </Text>
                                    <Text>
                                        {`${profiles[
                                            currentProfile
                                        ].ownedBy.substr(0, 5)}...${profiles[
                                            currentProfile
                                        ].ownedBy.substr(-5)}`}
                                    </Text>
                                    <HStack>Social links</HStack>
                                    <Button
                                        variant="outline"
                                        leftIcon={<AiOutlineDisconnect />}
                                        onClick={() => disconnect()}
                                    >
                                        Disconnect Wallet
                                    </Button>
                                </VStack>
                            </VStack>
                        )}

                    {profiles && profiles.length == 0 && (
                        <Heading>No Lens Profile found on Wallet</Heading>
                    )}

                    <Card>
                        {address ? (
                            <>
                                {profiles && currentProfile !== undefined && (
                                    <>
                                        <>
                                            {authSig ? (
                                                <>
                                                    <Tag colorScheme="green">
                                                        Connected to Lit Network
                                                    </Tag>
                                                    <Button
                                                        colorScheme="pink"
                                                        leftIcon={
                                                            <HiLockClosed />
                                                        }
                                                        onClick={onOpen}
                                                    >
                                                        Make a Encrypted Post
                                                    </Button>
                                                </>
                                            ) : (
                                                <Button onClick={connectToLit}>
                                                    Connect to Lit
                                                </Button>
                                            )}
                                        </>
                                    </>
                                )}
                            </>
                        ) : (
                            <Button onClick={() => connect()}>
                                Connect Wallet
                            </Button>
                        )}
                    </Card>
                </VStack>
            </Grid>
        </VStack>
    );
}
