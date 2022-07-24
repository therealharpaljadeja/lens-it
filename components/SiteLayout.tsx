import React, { FC, ReactNode } from "react";
import { Toaster } from "react-hot-toast";

interface Props {
    children: ReactNode;
}

const SiteLayout: FC<Props> = ({ children }) => {
    const toastOptions = {
        success: {
            className: "border border-green-500",
            iconTheme: {
                primary: "#10B981",
                secondary: "white",
            },
        },
        error: {
            className: "border border-red-500",
            iconTheme: {
                primary: "#EF4444",
                secondary: "white",
            },
        },
        loading: { className: "border border-gray-300" },
    };

    return (
        <>
            <Toaster position="bottom-right" toastOptions={toastOptions} />
            {children}
        </>
    );
};

export default SiteLayout;
