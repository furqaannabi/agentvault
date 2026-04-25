// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ProofAnchor} from "../src/ProofAnchor.sol";

contract ProofAnchorTest is Test {
    ProofAnchor anchor;

    function setUp() public {
        anchor = new ProofAnchor();
    }

    function test_AnchorRoot() public {
        bytes32 root = keccak256("trade-1");
        anchor.anchorRoot(root, "cid-abc");

        assertEq(anchor.anchoredAt(root), block.number);
        assertEq(anchor.anchoredBy(root), address(this));
        assertEq(anchor.anchoredCid(root), "cid-abc");
        assertTrue(anchor.isAnchored(root));
    }

    function test_RevertOnDoubleAnchor() public {
        bytes32 root = keccak256("trade-1");
        anchor.anchorRoot(root, "cid-abc");
        vm.expectRevert(ProofAnchor.AlreadyAnchored.selector);
        anchor.anchorRoot(root, "cid-xyz");
    }

    function test_RevertOnEmptyRoot() public {
        vm.expectRevert(ProofAnchor.EmptyRoot.selector);
        anchor.anchorRoot(bytes32(0), "cid");
    }

    function test_RevertOnEmptyCid() public {
        vm.expectRevert(ProofAnchor.EmptyCid.selector);
        anchor.anchorRoot(keccak256("x"), "");
    }

    function test_EmitsAnchored() public {
        bytes32 root = keccak256("trade-evt");
        vm.expectEmit(true, true, false, true);
        emit ProofAnchor.Anchored(root, address(this), "cid-evt", block.number);
        anchor.anchorRoot(root, "cid-evt");
    }
}
