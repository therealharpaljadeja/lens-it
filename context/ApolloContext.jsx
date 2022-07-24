import React, { useContext, useEffect, useState, useReducer } from "react";
import {
    ApolloClient,
    InMemoryCache,
    gql,
    ApolloLink,
    HttpLink,
} from "@apollo/client";
import fetch from "cross-fetch";
import { utils, ethers } from "ethers";
import omitDeep from "omit-deep";
import { LENS_HUB_ABI } from "../abi";
import { useSigner, useAccount, useProvider, useSignMessage } from "wagmi";

export const ApolloContext = React.createContext();

const httpLink = new HttpLink({
    uri: "https://api-mumbai.lens.dev/",
    fetch,
});

const authLink = new ApolloLink((operation, forward) => {
    const token = localStorage.getItem("lensAPIAccessToken");

    if (
        operation &&
        operation.variables &&
        operation.variables.request &&
        operation.variables.request.sortCriteria
    ) {
    } else {
        operation.setContext({
            headers: {
                "x-access-token": token ? `Bearer ${token}` : "",
            },
        });
    }
    // Use the setContext method to set the HTTP headers.

    // Call the next link in the middleware chain.
    return forward(operation);
});

const GET_CHALLENGE = `
  query($request: ChallengeRequest!) {
    challenge(request: $request) { text }
  }
`;

const AUTHENTICATION = `
  mutation($request: SignedAuthChallenge!) { 
    authenticate(request: $request) {
      accessToken
      refreshToken
    }
 }
`;

const VERIFY = `
  query($request: VerifyRequest!) {
    verify(request: $request)
  }
`;

const GET_PROFILES = `
  query($request: ProfileQueryRequest!) {
    profiles(request: $request) {
      items {
        id
        name
        bio
        picture {
          ... on NftImage {
            contractAddress
            tokenId
            uri
            verified
          }
          ... on MediaSet {
            original {
              url
              mimeType
            }
          }
          __typename
        }
        handle
        coverPicture {
          ... on NftImage {
            contractAddress
            tokenId
            uri
            verified
          }
          ... on MediaSet {
            original {
              url
              mimeType
            }
          }
          __typename
        }
        ownedBy
        dispatcher {
          address
          canUseRelay
        }
        stats {
          totalFollowers
          totalFollowing
          totalPosts
          totalComments
          totalMirrors
          totalPublications
          totalCollects
        }
        followModule {
          ... on FeeFollowModuleSettings {
            type
            amount {
              asset {
                symbol
                name
                decimals
                address
              }
              value
            }
            recipient
          }
          __typename
        }
      }
      pageInfo {
        prev
        next
        totalCount
      }
    }
  }
`;

const GET_PROFILE_ID_BY_HANDLE = `
query($request: SingleProfileQueryRequest!) {
    profile(request: $request) {
        id
    }
  }`;

const UPDATE_PROFILE = `
  mutation($request: UpdateProfileRequest!) { 
    updateProfile(request: $request) {
     id
     id
     name
     bio
     location
     website
     twitterUrl
     picture {
       ... on NftImage {
         contractAddress
         tokenId
         uri
         verified
       }
       ... on MediaSet {
         original {
           url
           mimeType
         }
       }
       __typename
     }
     handle
     coverPicture {
       ... on NftImage {
         contractAddress
         tokenId
         uri
         verified
       }
       ... on MediaSet {
         original {
           url
           mimeType
         }
       }
       __typename
     }
     ownedBy
     depatcher {
       address
       canUseRelay
     }
     stats {
       totalFollowers
       totalFollowing
       totalPosts
       totalComments
       totalMirrors
       totalPublications
       totalCollects
     }
     followModule {
       ... on FeeFollowModuleSettings {
         type
         amount {
           asset {
             symbol
             name
             decimals
             address
           }
           value
         }
         recipient
       }
       __typename
     }
    }
 }
`;

const GET_USERS_NFTS = `
  query($request: NFTsRequest!) {
    nfts(request: $request) {
      items {
        contractName
        contractAddress
        symbol
        tokenId
        owners {
          amount
          address
        }
        name
        description
        contentURI
        originalContent {
          uri
          metaType
        }
        chainId
        collectionName
        ercType
      }
    pageInfo {
        prev
        next
        totalCount
    }
  }
}
`;

const NFT_CHALLENGE = `
  query($request: NftOwnershipChallengeRequest!) {
    nftOwnershipChallenge(request: $request) { id, text }
  }
`;

const CREATE_SET_PROFILE_IMAGE_URI_TYPED_DATA = `
  mutation($request: UpdateProfileImageRequest!) { 
    createSetProfileImageURITypedData(request: $request) {
      id
      expiresAt
      typedData {
        domain {
          name
          chainId
          version
          verifyingContract
        }
        types {
          SetProfileImageURIWithSig {
            name
            type
          }
        }
        value {
          nonce
            deadline
            imageURI
            profileId
        }
      }
    }
 }
`;

const GET_PUBLICATIONS = `
query($request: PublicationsQueryRequest!) {
    publications(request: $request) {
      items {
        __typename 
        ... on Post {
          ...PostFields
        }
        ... on Comment {
          ...CommentFields
        }
        ... on Mirror {
          ...MirrorFields
        }
      }
      pageInfo {
        prev
        next
        totalCount
      }
    }
  }

  fragment MediaFields on Media {
    url
    mimeType
  }

  fragment ProfileFields on Profile {
    id
    name
    bio
    attributes {
      displayType
      traitType
      key
      value
    }
        isFollowedByMe
    isFollowing(who: null)
        followNftAddress
    metadata
    isDefault
    handle
    picture {
      ... on NftImage {
        contractAddress
        tokenId
        uri
        verified
      }
      ... on MediaSet {
        original {
          ...MediaFields
        }
      }
    }
    coverPicture {
      ... on NftImage {
        contractAddress
        tokenId
        uri
        verified
      }
      ... on MediaSet {
        original {
          ...MediaFields
        }
      }
    }
    ownedBy
    dispatcher {
      address
    }
    stats {
      totalFollowers
      totalFollowing
      totalPosts
      totalComments
      totalMirrors
      totalPublications
      totalCollects
    }
    followModule {
      ... on FeeFollowModuleSettings {
        type
        amount {
          asset {
            name
            symbol
            decimals
            address
          }
          value
        }
        recipient
      }
      ... on ProfileFollowModuleSettings {
       type
      }
      ... on RevertFollowModuleSettings {
       type
      }
    }
  }

  fragment PublicationStatsFields on PublicationStats { 
    totalAmountOfMirrors
    totalAmountOfCollects
    totalAmountOfComments
  }

  fragment MetadataOutputFields on MetadataOutput {
    name
    description
    content
    media {
      original {
        ...MediaFields
      }
    }
    attributes {
      displayType
      traitType
      value
    }
  }

  fragment Erc20Fields on Erc20 {
    name
    symbol
    decimals
    address
  }

  fragment CollectModuleFields on CollectModule {
    __typename
    ... on FreeCollectModuleSettings {
      type
    }
    ... on FeeCollectModuleSettings {
      type
      amount {
        asset {
          ...Erc20Fields
        }
        value
      }
      recipient
      referralFee
    }
    ... on LimitedFeeCollectModuleSettings {
      type
      collectLimit
      amount {
        asset {
          ...Erc20Fields
        }
        value
      }
      recipient
      referralFee
    }
    ... on LimitedTimedFeeCollectModuleSettings {
      type
      collectLimit
      amount {
        asset {
          ...Erc20Fields
        }
        value
      }
      recipient
      referralFee
      endTimestamp
    }
    ... on RevertCollectModuleSettings {
      type
    }
    ... on TimedFeeCollectModuleSettings {
      type
      amount {
        asset {
          ...Erc20Fields
        }
        value
      }
      recipient
      referralFee
      endTimestamp
    }
  }

  fragment PostFields on Post {
    id
    profile {
      ...ProfileFields
    }
    stats {
      ...PublicationStatsFields
    }
    metadata {
      ...MetadataOutputFields
    }
    createdAt
    collectModule {
      ...CollectModuleFields
    }
    referenceModule {
      ... on FollowOnlyReferenceModuleSettings {
        type
      }
    }
    appId
        hidden
        reaction(request: null)
    mirrors
    hasCollectedByMe
  }

  fragment MirrorBaseFields on Mirror {
    id
    profile {
      ...ProfileFields
    }
    stats {
      ...PublicationStatsFields
    }
    metadata {
      ...MetadataOutputFields
    }
    createdAt
    collectModule {
      ...CollectModuleFields
    }
    referenceModule {
      ... on FollowOnlyReferenceModuleSettings {
        type
      }
    }
    appId
        hidden
        reaction(request: null)
    hasCollectedByMe
  }

  fragment MirrorFields on Mirror {
    ...MirrorBaseFields
    mirrorOf {
     ... on Post {
        ...PostFields          
     }
     ... on Comment {
        ...CommentFields          
     }
    }
  }

  fragment CommentBaseFields on Comment {
    id
    profile {
      ...ProfileFields
    }
    stats {
      ...PublicationStatsFields
    }
    metadata {
      ...MetadataOutputFields
    }
    createdAt
    collectModule {
      ...CollectModuleFields
    }
    referenceModule {
      ... on FollowOnlyReferenceModuleSettings {
        type
      }
    }
    appId
        hidden
        reaction(request: null)
    mirrors
    hasCollectedByMe
  }

  fragment CommentFields on Comment {
    ...CommentBaseFields
    mainPost {
      ... on Post {
        ...PostFields
      }
      ... on Mirror {
        ...MirrorBaseFields
        mirrorOf {
          ... on Post {
             ...PostFields          
          }
          ... on Comment {
             ...CommentMirrorOfFields        
          }
        }
      }
    }
  }

  fragment CommentMirrorOfFields on Comment {
    ...CommentBaseFields
    mainPost {
      ... on Post {
        ...PostFields
      }
      ... on Mirror {
         ...MirrorBaseFields
      }
    }
  }
`;

const MODULE_APPROVAL_DATA = `
  query($request: GenerateModuleCurrencyApprovalDataRequest!) {
    generateModuleCurrencyApprovalData(request: $request) {
      to
      from
      data
    }
  }
`;

const ALLOWANCE = `
  query($request: ApprovedModuleAllowanceAmountRequest!) {
    approvedModuleAllowanceAmount(request: $request) {
      currency
      module
      contractAddress
      allowance
    }
  }
`;

const RECOMMENDED_PROFILES = `
  query {
    recommendedProfiles {
        id
        name
        bio
        location
        website
        twitterUrl
        picture {
          ... on NftImage {
            contractAddress
            tokenId
            uri
            verified
          }
          ... on MediaSet {
            original {
              url
              width
              height
              mimeType
            }
            small {
              url
              width
              height
              mimeType
            }
            medium {
              url
              width
              height
              mimeType
            }
          }
          __typename
        }
        handle
        coverPicture {
          ... on NftImage {
            contractAddress
            tokenId
            uri
            verified
          }
          ... on MediaSet {
            original {
              url
              width
              height
              mimeType
            }
            small {
              height
              width
              url
              mimeType
            }
            medium {
              url
              width
              height
              mimeType
            }
          }
          __typename
        }
        ownedBy
        depatcher {
          address
          canUseRelay
        }
        stats {
          totalFollowers
          totalFollowing
          totalPosts
          totalComments
          totalMirrors
          totalPublications
          totalCollects
        }
        followModule {
          ... on FeeFollowModuleSettings {
            type
            amount {
              asset {
                symbol
                name
                decimals
                address
              }
              value
            }
            recipient
          }
          __typename
        }
    }
  }
`;

const DOES_FOLLOW = `
  query($request: DoesFollowRequest!) {
    doesFollow(request: $request) { 
            followerAddress
        profileId
        follows
        }
  }
`;

const CREATE_PROFILE = `
  mutation($request: CreateProfileRequest!) { 
    createProfile(request: $request) {
      ... on RelayerResult {
        txHash
      }
      ... on RelayError {
        reason
      }
            __typename
    }
 }
`;

const EXPLORE_PUBLICATIONS = `
  query($request: ExplorePublicationRequest!) {
    explorePublications(request: $request) {
        items {
          __typename 
          ... on Post {
            ...PostFields
          }
          ... on Comment {
            ...CommentFields
          }
          ... on Mirror {
            ...MirrorFields
          }
        }
        pageInfo {
          prev
          next
          totalCount
        }
      }
    }
  
    fragment MediaFields on Media {
      url
      width
      height
      mimeType
    }
  
    fragment ProfileFields on Profile {
      id
      name
      bio
      attributes {
        displayType
        traitType
        key
        value
      }
          isFollowedByMe
      isFollowing(who: null)
          followNftAddress
      metadata
      isDefault
      handle
      picture {
        ... on NftImage {
          contractAddress
          tokenId
          uri
          verified
        }
        ... on MediaSet {
          original {
            ...MediaFields
          }
          small {
            ...MediaFields
          }
          medium {
            ...MediaFields
          }
        }
      }
      coverPicture {
        ... on NftImage {
          contractAddress
          tokenId
          uri
          verified
        }
        ... on MediaSet {
          original {
            ...MediaFields
          }
          small {
           ...MediaFields
          }
          medium {
            ...MediaFields
          }
        }
      }
      ownedBy
      dispatcher {
        address
      }
      stats {
        totalFollowers
        totalFollowing
        totalPosts
        totalComments
        totalMirrors
        totalPublications
        totalCollects
      }
      followModule {
        ... on FeeFollowModuleSettings {
          type
          amount {
            asset {
              name
              symbol
              decimals
              address
            }
            value
          }
          recipient
        }
        ... on ProfileFollowModuleSettings {
         type
        }
        ... on RevertFollowModuleSettings {
         type
        }
      }
    }
  
    fragment PublicationStatsFields on PublicationStats { 
      totalAmountOfMirrors
      totalAmountOfCollects
      totalAmountOfComments
    }
  
    fragment MetadataOutputFields on MetadataOutput {
      name
      description
      content
      media {
        original {
          ...MediaFields
        }
        small {
          ...MediaFields
        }
        medium {
          ...MediaFields
        }
      }
      attributes {
        displayType
        traitType
        value
      }
    }
  
    fragment Erc20Fields on Erc20 {
      name
      symbol
      decimals
      address
    }
  
    fragment CollectModuleFields on CollectModule {
      __typename
      ... on FreeCollectModuleSettings {
        type
      }
      ... on FeeCollectModuleSettings {
        type
        amount {
          asset {
            ...Erc20Fields
          }
          value
        }
        recipient
        referralFee
      }
      ... on LimitedFeeCollectModuleSettings {
        type
        collectLimit
        amount {
          asset {
            ...Erc20Fields
          }
          value
        }
        recipient
        referralFee
      }
      ... on LimitedTimedFeeCollectModuleSettings {
        type
        collectLimit
        amount {
          asset {
            ...Erc20Fields
          }
          value
        }
        recipient
        referralFee
        endTimestamp
      }
      ... on RevertCollectModuleSettings {
        type
      }
      ... on TimedFeeCollectModuleSettings {
        type
        amount {
          asset {
            ...Erc20Fields
          }
          value
        }
        recipient
        referralFee
        endTimestamp
      }
    }
  
    fragment PostFields on Post {
      id
      profile {
        ...ProfileFields
      }
      stats {
        ...PublicationStatsFields
      }
      metadata {
        ...MetadataOutputFields
      }
      createdAt
      collectModule {
        ...CollectModuleFields
      }
      referenceModule {
        ... on FollowOnlyReferenceModuleSettings {
          type
        }
      }
      appId
          hidden
          reaction(request: null)
          mirrors(by: null)
      hasCollectedByMe
    }
  
    fragment MirrorBaseFields on Mirror {
      id
      profile {
        ...ProfileFields
      }
      stats {
        ...PublicationStatsFields
      }
      metadata {
        ...MetadataOutputFields
      }
      createdAt
      collectModule {
        ...CollectModuleFields
      }
      referenceModule {
        ... on FollowOnlyReferenceModuleSettings {
          type
        }
      }
      appId
        hidden
      reaction(request: null)
      hasCollectedByMe
    }
  
    fragment MirrorFields on Mirror {
      ...MirrorBaseFields
      mirrorOf {
       ... on Post {
          ...PostFields          
       }
       ... on Comment {
          ...CommentFields          
       }
      }
    }
  
    fragment CommentBaseFields on Comment {
      id
      profile {
        ...ProfileFields
      }
      stats {
        ...PublicationStatsFields
      }
      metadata {
        ...MetadataOutputFields
      }
      createdAt
      collectModule {
        ...CollectModuleFields
      }
      referenceModule {
        ... on FollowOnlyReferenceModuleSettings {
          type
        }
      }
      appId
        hidden
      reaction(request: null)
      mirrors(by: null)
      hasCollectedByMe
    }
  
    fragment CommentFields on Comment {
      ...CommentBaseFields
      mainPost {
        ... on Post {
          ...PostFields
        }
        ... on Mirror {
          ...MirrorBaseFields
          mirrorOf {
            ... on Post {
               ...PostFields          
            }
            ... on Comment {
               ...CommentMirrorOfFields        
            }
          }
        }
      }
    }
  
    fragment CommentMirrorOfFields on Comment {
      ...CommentBaseFields
      mainPost {
        ... on Post {
          ...PostFields
        }
        ... on Mirror {
           ...MirrorBaseFields
        }
      }
    }
`;

const prettyJSON = (message, obj) => {
    console.log(message, JSON.stringify(obj, null, 2));
};

const sleep = (milliseconds) => {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
};

const INITIAL_STATE = {};

const apolloReducer = (state, action) => {
    switch (action.type) {
        case "SET_PROFILES":
            return { profiles: action.payload };
        case "SET_PROFILE":
            console.log(action.payload);
            let profile = action.payload;
            let id = profile.id;
            return {
                ...state,
                profiles: state.profiles.map((profile) => {
                    if (profile.id == id) {
                        return action.payload;
                    } else return profile;
                }),
            };
        case "CURRENT_PROFILE":
            return { ...state, currentProfile: action.payload };
        case "SET_NFTS":
            return { ...state, nfts: action.payload };
        case "CLEAR":
            return INITIAL_STATE;
    }
};

const HAS_TX_BEEN_INDEXED = `
  query($request: HasTxHashBeenIndexedRequest!) {
    hasTxHashBeenIndexed(request: $request) { 
             ... on TransactionIndexedResult {
        indexed
                txReceipt {
          to
          from
          contractAddress
          transactionIndex
          root
          gasUsed
          logsBloom
          blockHash
          transactionHash
          blockNumber
          confirmations
          cumulativeGasUsed
          effectiveGasPrice
          byzantium
          type
          status
          logs {
            blockNumber
            blockHash
            transactionIndex
            removed
            address
            data
            topics
            transactionHash
            logIndex
          }
        }
        metadataStatus {
          status
          reason
        }
        }
        ... on TransactionError {
        reason
                txReceipt {
          to
          from
          contractAddress
          transactionIndex
          root
          gasUsed
          logsBloom
          blockHash
          transactionHash
          blockNumber
          confirmations
          cumulativeGasUsed
          effectiveGasPrice
          byzantium
          type
          status
          logs {
            blockNumber
            blockHash
            transactionIndex
            removed
            address
            data
            topics
            transactionHash
            logIndex
          }
        }
        }
            __typename
        }
  }
`;

const CREATE_POST_TYPED_DATA = `
  mutation($request: CreatePublicPostRequest!) { 
    createPostTypedData(request: $request) {
      id
      expiresAt
      typedData {
        types {
          PostWithSig {
            name
            type
          }
        }
      domain {
        name
        chainId
        version
        verifyingContract
      }
      value {
        nonce
        deadline
        profileId
        contentURI
        collectModule
        collectModuleInitData
        referenceModule
        referenceModuleInitData
      }
     }
   }
 }
`;

const GET_PUBLICATION = `
  query($request: PublicationQueryRequest!) {
    publication(request: $request) {
        __typename 
        ... on Post {
          ...PostFields
        }
        ... on Comment {
          ...CommentFields
        }
        ... on Mirror {
          ...MirrorFields
      }
    }
  }

  fragment MediaFields on Media {
    url
    mimeType
  }

  fragment ProfileFields on Profile {
    id
    name
    bio
    location
    website
    twitterUrl
    handle
    picture {
      ... on NftImage {
        contractAddress
        tokenId
        uri
        verified
      }
      ... on MediaSet {
        original {
          ...MediaFields
        }
      }
    }
    coverPicture {
      ... on NftImage {
        contractAddress
        tokenId
        uri
        verified
      }
      ... on MediaSet {
        original {
          ...MediaFields
        }
      }
    }
    ownedBy
    depatcher {
      address
    }
    stats {
      totalFollowers
      totalFollowing
      totalPosts
      totalComments
      totalMirrors
      totalPublications
      totalCollects
    }
    followModule {
      ... on FeeFollowModuleSettings {
        type
        amount {
          asset {
            name
            symbol
            decimals
            address
          }
          value
        }
        recipient
      }
    }
  }

  fragment PublicationStatsFields on PublicationStats { 
    totalAmountOfMirrors
    totalAmountOfCollects
    totalAmountOfComments
  }

  fragment MetadataOutputFields on MetadataOutput {
    name
    description
    content
    media {
      original {
        ...MediaFields
      }
    }
    attributes {
      displayType
      traitType
      value
    }
  }

  fragment Erc20Fields on Erc20 {
    name
    symbol
    decimals
    address
  }

  fragment CollectModuleFields on CollectModule {
    __typename
    ... on FreeCollectModuleSettings {
      type
    }
    ... on FeeCollectModuleSettings {
      type
      amount {
        asset {
          ...Erc20Fields
        }
        value
      }
      recipient
      referralFee
    }
    ... on LimitedFeeCollectModuleSettings {
      type
      collectLimit
      amount {
        asset {
          ...Erc20Fields
        }
        value
      }
      recipient
      referralFee
    }
    ... on LimitedTimedFeeCollectModuleSettings {
      type
      collectLimit
      amount {
        asset {
          ...Erc20Fields
        }
        value
      }
      recipient
      referralFee
      endTimestamp
    }
    ... on RevertCollectModuleSettings {
      type
    }
    ... on TimedFeeCollectModuleSettings {
      type
      amount {
        asset {
          ...Erc20Fields
        }
        value
      }
      recipient
      referralFee
      endTimestamp
    }
  }

  fragment PostFields on Post {
    id
    profile {
      ...ProfileFields
    }
    stats {
      ...PublicationStatsFields
    }
    metadata {
      ...MetadataOutputFields
    }
    createdAt
    collectModule {
      ...CollectModuleFields
    }
    referenceModule {
      ... on FollowOnlyReferenceModuleSettings {
        type
      }
    }
    appId
  }

  fragment MirrorBaseFields on Mirror {
    id
    profile {
      ...ProfileFields
    }
    stats {
      ...PublicationStatsFields
    }
    metadata {
      ...MetadataOutputFields
    }
    createdAt
    collectModule {
      ...CollectModuleFields
    }
    referenceModule {
      ... on FollowOnlyReferenceModuleSettings {
        type
      }
    }
    appId
  }

  fragment MirrorFields on Mirror {
    ...MirrorBaseFields
    mirrorOf {
     ... on Post {
        ...PostFields          
     }
     ... on Comment {
        ...CommentFields          
     }
    }
  }

  fragment CommentBaseFields on Comment {
    id
    profile {
      ...ProfileFields
    }
    stats {
      ...PublicationStatsFields
    }
    metadata {
      ...MetadataOutputFields
    }
    createdAt
    collectModule {
      ...CollectModuleFields
    }
    referenceModule {
      ... on FollowOnlyReferenceModuleSettings {
        type
      }
    }
    appId
  }

  fragment CommentFields on Comment {
    ...CommentBaseFields
    mainPost {
      ... on Post {
        ...PostFields
      }
      ... on Mirror {
        ...MirrorBaseFields
        mirrorOf {
          ... on Post {
             ...PostFields          
          }
          ... on Comment {
             ...CommentMirrorOfFields        
          }
        }
      }
    }
  }

  fragment CommentMirrorOfFields on Comment {
    ...CommentBaseFields
    mainPost {
      ... on Post {
        ...PostFields
      }
      ... on Mirror {
         ...MirrorBaseFields
      }
    }
  }
`;

const CREATE_COMMENT_TYPED_DATA = `
  mutation($request: CreatePublicCommentRequest!) { 
    createCommentTypedData(request: $request) {
      id
      expiresAt
      typedData {
        types {
          CommentWithSig {
            name
            type
          }
        }
      domain {
        name
        chainId
        version
        verifyingContract
      }
      value {
        nonce
        deadline
        profileId
        profileIdPointed
        pubIdPointed
        contentURI
        collectModule
        collectModuleData
        referenceModule
        referenceModuleData
      }
     }
   }
 }
`;

const CREATE_FOLLOW_TYPED_DATA = `
  mutation($request: FollowRequest!) { 
    createFollowTypedData(request: $request) {
      id
      expiresAt
      typedData {
        domain {
          name
          chainId
          version
          verifyingContract
        }
        types {
          FollowWithSig {
            name
            type
          }
        }
        value {
          nonce
          deadline
          profileIds
          datas
        }
      }
    }
 }
`;

const HAS_COLLECTED = `
  query($request: HasCollectedRequest!) {
    hasCollected(request: $request) {
      walletAddress
      results {
        collected
        publicationId
        collectedTimes
      }
    }
  }
`;

const CREATE_COLLECT_TYPED_DATA = `
  mutation($request: CreateCollectRequest!) { 
    createCollectTypedData(request: $request) {
      id
      expiresAt
      typedData {
        types {
          CollectWithSig {
            name
            type
          }
        }
      domain {
        name
        chainId
        version
        verifyingContract
      }
      value {
        nonce
        deadline
        profileId
        pubId
        data
      }
     }
   }
 }
`;

function ApolloContextProvider({ children }) {
    const {
        data: signer,
        error,
        isError,
        isLoading: isSignerLoading,
        status,
    } = useSigner();
    const { address: account, isDisconnected } = useAccount();
    const [apolloContext, dispatch] = useReducer(apolloReducer, INITIAL_STATE);
    console.log("apollo client setup!");
    const apolloClient = new ApolloClient({
        link: authLink.concat(httpLink),
        cache: new InMemoryCache(),
        defaultOptions: {
            watchQuery: {
                fetchPolicy: "no-cache",
                errorPolicy: "ignore",
            },
            query: {
                fetchPolicy: "no-cache",
                errorPolicy: "all",
            },
        },
    });

    useEffect(() => {
        if (
            !isDisconnected &&
            signer &&
            account !== null &&
            account !== undefined
        ) {
            console.log(signer);
            console.log(isDisconnected);
            console.log("connecting");
            getProfilesByAccount();
        }
    }, [account, signer]);

    const generateChallenge = (address) => {
        return apolloClient.query({
            query: gql(GET_CHALLENGE),
            variables: {
                request: {
                    address,
                },
            },
        });
    };

    const authenticate = (address, signature) => {
        return apolloClient.mutate({
            mutation: gql(AUTHENTICATION),
            variables: {
                request: {
                    address,
                    signature,
                },
            },
        });
    };

    const verify = (accessToken) => {
        return apolloClient.query({
            query: gql(VERIFY),
            variables: {
                request: {
                    accessToken,
                },
            },
        });
    };

    const getProfilesRequest = (request) => {
        return apolloClient.query({
            query: gql(GET_PROFILES),
            variables: {
                request,
            },
        });
    };

    const getProfileIdByHandleRequest = (request) => {
        return apolloClient.query({
            query: gql(GET_PROFILE_ID_BY_HANDLE),
            variables: {
                request,
            },
        });
    };

    async function signChallenge(address) {
        const challengeResponse = await generateChallenge(address);
        if (signer.signMessage) {
            const signature = await signer.signMessage(
                challengeResponse.data.challenge.text
            );

            const accessTokens = await authenticate(address, signature);
            console.log(accessTokens.data);
            localStorage.setItem(
                "lensAPIAccessToken",
                accessTokens.data.authenticate.accessToken
            );
            localStorage.setItem(
                "lensAPIRefreshToken",
                accessTokens.data.authenticate.refreshToken
            );
        }
    }

    async function login() {
        let authenticationToken = localStorage.getItem("lensAPIAccessToken");
        if (authenticationToken) {
            let isAuthenticated = (await verify(authenticationToken)).data
                .verify;
            if (!isAuthenticated) {
                await signChallenge(account);
            }
        } else {
            await signChallenge(account);
        }
    }

    async function getProfilesByProfileIds(request) {
        const response = await getProfilesRequest(request);
        return response;
    }

    async function getProfileIdByHandle(request) {
        const response = await getProfileIdByHandleRequest(request);
        return response;
    }

    async function getProfilesByAccount() {
        await login(account);
        console.log("logging");
        let request = { ownedBy: account };

        const profilesFromProfileIds = await getProfilesRequest(request);
        dispatch({
            type: "SET_PROFILES",
            payload: profilesFromProfileIds.data.profiles.items,
        });

        console.log(profilesFromProfileIds);

        if (profilesFromProfileIds.data.profiles.items) {
            dispatch({ type: "CURRENT_PROFILE", payload: 0 });
        }
    }

    async function updateProfile(profileInfo) {
        await login(account);
        return apolloClient.mutate({
            mutation: gql(UPDATE_PROFILE),
            variables: {
                request: profileInfo,
            },
        });
    }

    async function getUsersNfts(contractAddress) {
        await login(account);
        return apolloClient.query({
            query: gql(GET_USERS_NFTS),
            variables: {
                request: {
                    ownerAddress: account,
                    contractAddress,
                    chainIds: [80001],
                    limit: 20,
                },
            },
        });
    }

    async function getNfts(contractAddress) {
        let { data } = await getUsersNfts(contractAddress);
        console.log(data);
        dispatch({ type: "SET_NFTS", payload: data.nfts.items });
    }

    const generateNftChallenge = (nfts) => {
        return apolloClient.query({
            query: gql(NFT_CHALLENGE),
            variables: {
                request: {
                    ethereumAddress: account,
                    nfts,
                },
            },
        });
    };

    const createSetProfileImageUriTypedData = (request) => {
        return apolloClient.mutate({
            mutation: gql(CREATE_SET_PROFILE_IMAGE_URI_TYPED_DATA),
            variables: {
                request,
            },
        });
    };

    async function updateProfilePictureUri(profileId, index) {
        let { contractAddress, tokenId, chainId } = apolloContext.nfts[index];
        let { data } = await generateNftChallenge([
            { contractAddress, tokenId, chainId },
        ]);

        let signature = await signer.signMessage(
            data.nftOwnershipChallenge.text
        );
        let response = await createSetProfileImageUriTypedData({
            profileId,
            nftData: {
                id: data.nftOwnershipChallenge.id,
                signature,
            },
        });
        console.log(response);
    }

    async function getPublications(getPublicationQuery) {
        return apolloClient.query({
            query: gql(GET_PUBLICATIONS),
            variables: {
                request: getPublicationQuery,
            },
        });
    }

    async function enabledCurrencies() {
        await login(account);
        return apolloClient.query({
            query: gql(ENABLED_CURRENCIES),
        });
    }

    async function enabledModules() {
        await login(account);
        return apolloClient.query({
            query: gql(ENABLED_MODULES),
        });
    }

    async function getModuleApprovalData(moduleApprovalRequest) {
        await login(account);
        return apolloClient.query({
            query: gql(MODULE_APPROVAL_DATA),
            variables: {
                request: moduleApprovalRequest,
            },
        });
    }

    async function allowance(allowanceRequest) {
        await login(account);
        return apolloClient.query({
            query: gql(ALLOWANCE),
            variables: {
                request: allowanceRequest,
            },
        });
    }

    async function getRecommendedProfiles() {
        return apolloClient.query({
            query: gql(RECOMMENDED_PROFILES),
        });
    }

    async function doesFollow(followInfos) {
        await login(account);
        console.log(followInfos);
        return apolloClient.query({
            query: gql(DOES_FOLLOW),
            variables: {
                request: {
                    followInfos,
                },
            },
        });
    }

    async function createProfile(createProfileRequest) {
        await login(account);
        console.log(createProfileRequest);
        return apolloClient.mutate({
            mutation: gql(CREATE_PROFILE),
            variables: {
                request: createProfileRequest,
            },
        });
    }

    async function hasTxBeenIndexed(txHash) {
        return apolloClient.query({
            query: gql(HAS_TX_BEEN_INDEXED),
            variables: {
                request: {
                    txHash,
                },
            },
            fetchPolicy: "network-only",
        });
    }

    const pollUntilIndexed = async (txHash) => {
        while (true) {
            console.log(txHash);
            const result = await hasTxBeenIndexed(txHash);
            const response = result.data.hasTxHashBeenIndexed;
            if (response.__typename === "TransactionIndexedResult") {
                if (response.metadataStatus) {
                    if (response.metadataStatus.status === "SUCCESS") {
                        return response;
                    }

                    if (
                        response.metadataStatus.status ===
                        "METADATA_VALIDATION_FAILED"
                    ) {
                        throw new Error(response.metadataStatus.reason);
                    }
                } else {
                    if (response.indexed) {
                        return response;
                    }
                }

                console.log(response);
                // sleep for a second before trying again
                await new Promise((resolve) => setTimeout(resolve, 500));
            }
            console.log("out of loop");
            // it got reverted and failed!
            throw new Error(response.reason);
        }
    };

    async function createPostTypedData(createPostTypedDataRequest) {
        await login(account);
        return apolloClient.mutate({
            mutation: gql(CREATE_POST_TYPED_DATA),
            variables: {
                request: createPostTypedDataRequest,
            },
        });
    }

    async function explorePublications() {
        return apolloClient.query({
            query: gql(EXPLORE_PUBLICATIONS),
            variables: {
                request: {
                    sources: ["lens-it-working"],
                    sortCriteria: "LATEST",
                },
            },
            fetchPolicy: "network-only",
        });
    }

    async function getPublication(publicationId) {
        console.log(publicationId);
        return apolloClient.query({
            query: gql(GET_PUBLICATION),
            variables: {
                request: {
                    publicationId: publicationId,
                },
            },
        });
    }

    async function createCommentTypedData(createCommentTypedDataRequest) {
        return apolloClient.mutate({
            mutation: gql(CREATE_COMMENT_TYPED_DATA),
            variables: {
                request: createCommentTypedDataRequest,
            },
        });
    }

    async function createFollowTypedData(followRequestInfo) {
        console.log(followRequestInfo);
        return apolloClient.mutate({
            mutation: gql(CREATE_FOLLOW_TYPED_DATA),
            variables: {
                request: followRequestInfo,
            },
        });
    }

    const splitSignature = (signature) => {
        return utils.splitSignature(signature);
    };

    async function signedTypeData(domain, types, value) {
        return signer._signTypedData(
            omitDeep(domain, "__typename"),
            omitDeep(types, "__typename"),
            omitDeep(value, "__typename")
        );
    }

    async function commentWithSig(typedData) {
        const signature = await signedTypeData(
            typedData.domain,
            typedData.types,
            typedData.value
        );

        console.log("create post: signature", signature);

        const { v, r, s } = splitSignature(signature);
        const lensHub = new ethers.Contract(
            "0xd7B3481De00995046C7850bCe9a5196B7605c367",
            LENS_HUB_ABI,
            signer
        );

        const tx = await lensHub.commentWithSig({
            profileId: typedData.value.profileId,
            contentURI: typedData.value.contentURI,
            profileIdPointed: typedData.value.profileIdPointed,
            pubIdPointed: typedData.value.pubIdPointed,
            collectModule: typedData.value.collectModule,
            collectModuleData: typedData.value.collectModuleData,
            referenceModule: typedData.value.referenceModule,
            referenceModuleData: typedData.value.referenceModuleData,
            sig: {
                v,
                r,
                s,
                deadline: typedData.value.deadline,
            },
        });
        console.log("create post: tx hash", tx.hash);
    }

    async function followWithSig(typedData) {
        const signature = await signedTypeData(
            typedData.domain,
            typedData.types,
            typedData.value
        );

        console.log("create post: signature", signature);

        const { v, r, s } = splitSignature(signature);
        const lensHub = new ethers.Contract(
            "0xd7B3481De00995046C7850bCe9a5196B7605c367",
            LENS_HUB_ABI,
            signer
        );

        const tx = await lensHub.followWithSig({
            follower: account,
            profileIds: typedData.value.profileIds,
            datas: typedData.value.datas,
            sig: {
                v,
                r,
                s,
                deadline: typedData.value.deadline,
            },
        });
        console.log("create post: tx hash", tx.hash);
    }

    async function hasCollected(request) {
        return apolloClient.query({
            query: gql(HAS_COLLECTED),
            variables: {
                request,
            },
        });
    }

    async function createCollectTypedData(createCollectTypedDataRequest) {
        return apolloClient.mutate({
            mutation: gql(CREATE_COLLECT_TYPED_DATA),
            variables: {
                request: createCollectTypedDataRequest,
            },
        });
    }

    async function collectWithSig(typedData) {
        const signature = await signer._signTypedData(
            omitDeep(typedData.domain, "__typename"),
            omitDeep(typedData.types, "__typename"),
            omitDeep(typedData.value, "__typename")
        );

        console.log("create post: signature", signature);

        const { v, r, s } = splitSignature(signature);
        const lensHub = new ethers.Contract(
            "0xd7B3481De00995046C7850bCe9a5196B7605c367",
            LENS_HUB_ABI,
            signer
        );

        const tx = await lensHub.collectWithSig({
            collector: account,
            profileId: typedData.value.profileId,
            pubId: typedData.value.pubId,
            data: typedData.value.data,
            sig: {
                v,
                r,
                s,
                deadline: typedData.value.deadline,
            },
        });
        console.log("create post: tx hash", tx.hash);
    }

    function clearState() {
        dispatch({ type: "CLEAR" });
    }

    return (
        <ApolloContext.Provider
            value={{
                apolloClient,
                authenticate,
                getProfiles: getProfilesByAccount,
                getProfilesByProfileIds,
                getProfileIdByHandle,
                verify,
                updateProfile,
                apolloContext,
                dispatch,
                getNfts,
                updateProfilePictureUri,
                getPublications,
                enabledCurrencies,
                enabledModules,
                getModuleApprovalData,
                allowance,
                getRecommendedProfiles,
                doesFollow,
                createProfile,
                hasTxBeenIndexed,
                pollUntilIndexed,
                createPostTypedData,
                explorePublications,
                getPublication,
                commentWithSig,
                createCommentTypedData,
                createFollowTypedData,
                followWithSig,
                hasCollected,
                collectWithSig,
                createCollectTypedData,
                clearState,
            }}
        >
            {children}
        </ApolloContext.Provider>
    );
}

export default ApolloContextProvider;
