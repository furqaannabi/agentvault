// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ProofAnchor
/// @notice Records the keccak256 root of an off-chain Proof object so anyone
///         can later verify the proof was anchored at a specific block.
/// @dev    Deployed on 0G Galileo testnet (chainId 16602). Read path:
///         `anchoredAt(root) > 0` means anchored.
contract ProofAnchor {
    /// @dev root => block number it was anchored at (0 = not anchored)
    mapping(bytes32 => uint256) public anchoredAt;

    /// @dev root => signer that anchored it
    mapping(bytes32 => address) public anchoredBy;

    /// @dev root => Storage Log CID containing the full Proof object
    mapping(bytes32 => string) public anchoredCid;

    event Anchored(
        bytes32 indexed root,
        address indexed signer,
        string logCid,
        uint256 blockNumber
    );

    error AlreadyAnchored();
    error EmptyRoot();
    error EmptyCid();

    function anchorRoot(bytes32 root, string calldata logCid) external {
        if (root == bytes32(0)) revert EmptyRoot();
        if (bytes(logCid).length == 0) revert EmptyCid();
        if (anchoredAt[root] != 0) revert AlreadyAnchored();

        anchoredAt[root] = block.number;
        anchoredBy[root] = msg.sender;
        anchoredCid[root] = logCid;

        emit Anchored(root, msg.sender, logCid, block.number);
    }

    function isAnchored(bytes32 root) external view returns (bool) {
        return anchoredAt[root] != 0;
    }
}
