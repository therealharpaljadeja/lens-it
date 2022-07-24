import React from "react";
import { VStack } from "@chakra-ui/react";

const Card = ({ children, ...props }) => {
    return (
        <VStack
            width="100%"
            border="1px solid"
            p={4}
            boxShadow="md"
            borderColor="gray.400"
            borderRadius="md"
            spacing={4}
            {...props}
        >
            {children}
        </VStack>
    );
};

export default Card;
