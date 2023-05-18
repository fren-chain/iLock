import * as React from "react";
import { useColorMode, useColorModeValue, IconButton, } from "@chakra-ui/react";
import { IoMoonOutline } from "react-icons/io5";
import { SunIcon } from "@chakra-ui/icons";
export const ColorModeSwitcher = (props) => {
    const { toggleColorMode } = useColorMode();
    const text = useColorModeValue("dark", "light");
    const SwitchIcon = useColorModeValue(IoMoonOutline, SunIcon);
    return (<IconButton size="md" fontSize="lg" variant="ghost" color="current" marginLeft="4" borderWidth="1px" onClick={toggleColorMode} icon={<SwitchIcon />} aria-label={`Switch to ${text} mode`} {...props}/>);
};
