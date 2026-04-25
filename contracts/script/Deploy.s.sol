// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ProofAnchor} from "../src/ProofAnchor.sol";

contract Deploy is Script {
    function run() external returns (ProofAnchor anchor) {
        uint256 pk = vm.envUint("ZG_PRIVATE_KEY");
        vm.startBroadcast(pk);
        anchor = new ProofAnchor();
        vm.stopBroadcast();
        console2.log("ProofAnchor deployed at:", address(anchor));
        console2.log("ChainId:", block.chainid);
    }
}
