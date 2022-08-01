// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

/**
 * @dev These functions deal with verification of Merkle Trees proofs.
 *
 * The proofs can be generated using the JavaScript library
 * https://github.com/miguelmota/merkletreejs[merkletreejs].
 * Note: the hashing algorithm should be keccak256 and pair sorting should be enabled.
 *
 * See `test/utils/cryptography/MerkleProof.test.js` for some examples.
 */
library MerkleProof {
    /**
     * @dev Returns true if a `leaf` can be proved to be a part of a Merkle tree
     * defined by `root`. For this, a `proof` must be provided, containing
     * sibling hashes on the branch from the leaf to the root of the tree. Each
     * pair of leaves and each pair of pre-images are assumed to be sorted.
     */
    function verify(
        bytes32[] memory proof,
        bytes32 root,
        bytes32 leaf
    ) internal pure returns (bool) {
        return processProof(proof, leaf) == root;
    }

    /**
     * @dev Returns the rebuilt hash obtained by traversing a Merklee tree up
     * from `leaf` using `proof`. A `proof` is valid if and only if the rebuilt
     * hash matches the root of the tree. When processing the proof, the pairs
     * of leafs & pre-images are assumed to be sorted.
     *
     * _Available since v4.4._
     */
    function processProof(bytes32[] memory proof, bytes32 leaf) internal pure returns (bytes32) {
        bytes32 computedHash = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];
            if (computedHash <= proofElement) {
                // Hash(current computed hash + current element of the proof)
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            } else {
                // Hash(current element of the proof + current computed hash)
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
            }
        }
        return computedHash;
    }
}

import "hardhat/console.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

interface IConsoleCredits {
  function getNumberOfClaimedTokens(address _address) external view returns (uint);
  function mintTokens(address _receiver, uint _addBaseValue, uint _tokensToMint) external;
}

contract Console_Credits_Resolver_V1 is ReentrancyGuard, Ownable {

    address CreditsAddress;

    bytes32 public _rootHash;

    IConsoleCredits public CreditsContract;

    struct ConsoleNFT {
      string token_id;
      string nft_type;
      string rarity;
      string airdrops;
    }

    ConsoleNFT[] public Console_NFT_Values;
	
	mapping(uint => bool) private _claimedAirdropTokens;

    function setTargetContract(address _setAddress) external onlyOwner {
        CreditsAddress = _setAddress;
    }

    constructor(address _CreditsAddress) {
		CreditsAddress = _CreditsAddress;
    }
	
	function setRootHash(bytes32 rootHash) external nonReentrant onlyOwner {
		_rootHash = rootHash;
	}

    function mintTokens(bytes32[] memory proof, uint _baseValue, ConsoleNFT[] memory nfts) external nonReentrant {
		
		string memory _msgSenderString = Strings.toHexString(uint160(msg.sender), 20);

		string memory _baseValueString = Strings.toString(_baseValue);
		
		string memory packedNFTs;

        for (uint i=0; i < nfts.length; i++) {
            packedNFTs = append(packedNFTs, nfts[i].token_id, nfts[i].nft_type, nfts[i].rarity, nfts[i].airdrops);
        }
		
		string memory _computedLeaf = string(abi.encodePacked(_msgSenderString, _baseValueString, packedNFTs));
		
        // Merkle tree validation
        bytes32 leaf = keccak256(abi.encodePacked(_computedLeaf));
        require(MerkleProof.verify(proof, _rootHash, leaf), "Invalid proof");

        // Get the current Base Credits Value
        CreditsContract = IConsoleCredits(CreditsAddress);

        uint UserBaseTokens = CreditsContract.getNumberOfClaimedTokens(msg.sender);
        
        // Mint new tokens based on calculations

        // Loop through owned NFTs
        uint _addBaseValue = _baseValue - UserBaseTokens;
        uint _tokensToMint;
		
        for (uint i=0; i < nfts.length; i++) {
            uint multiplier = getNFTMultiplier(nfts[i]);

            _tokensToMint += _addBaseValue * multiplier;
        }
		
		if (nfts.length == 0) {
			_tokensToMint = _addBaseValue;
		}
		else {
			_tokensToMint = _tokensToMint / 100; // Used multiplier needs to be divided by 100
		}

        CreditsContract.mintTokens(msg.sender, _addBaseValue, _tokensToMint);

    }

    function claimAirdrop(bytes32[] memory proof, uint _baseValue, ConsoleNFT[] memory nfts) external nonReentrant {
		
		// Same validation so we do not need to push two merkle roots
		
		string memory _msgSenderString = Strings.toHexString(uint160(msg.sender), 20);

		string memory _baseValueString = Strings.toString(_baseValue);
		
		string memory packedNFTs;

        for (uint i=0; i < nfts.length; i++) {
			
			// Check if the upgrade was already used in airdrop
			require(_claimedAirdropTokens[stringToUint(nfts[i].token_id)] == false, "Token already used in airdrop");
			
            packedNFTs = append(packedNFTs, nfts[i].token_id, nfts[i].nft_type, nfts[i].rarity, nfts[i].airdrops);
			
        }
		
		string memory _computedLeaf = string(abi.encodePacked(_msgSenderString, _baseValueString, packedNFTs));
		
        // Merkle tree validation
        bytes32 leaf = keccak256(abi.encodePacked(_computedLeaf));
        require(MerkleProof.verify(proof, _rootHash, leaf), "Invalid proof");
	
        // Loop through owned NFTs
        uint _tokensToMint;
		
        for (uint i=0; i < nfts.length; i++) {
			
			_claimedAirdropTokens[stringToUint(nfts[i].token_id)] = true;
			
            uint airdrops = getNFTAirdrops(nfts[i]);

            _tokensToMint += 10000 * (airdrops + 1);
        }
		
        CreditsContract.mintTokens(msg.sender, 0, _tokensToMint);

    }

    function append(string memory a, string memory b, string memory c, string memory d, string memory e) internal pure returns (string memory) {

        return string(abi.encodePacked(a, b, c, d, e));

    }
	
    function getNFTMultiplier(ConsoleNFT memory nft) public pure returns (uint) {
		
		uint multiplier = 100;
		
		if (stringCheck(nft.nft_type, "Vault")) {
			
			if (stringCheck(nft.rarity, "1")) { // Common
				multiplier = 150;
			}
			if (stringCheck(nft.rarity, "2")) { // Uncommon
				multiplier = 210;
			}
			if (stringCheck(nft.rarity, "3")) { // Rare
				multiplier = 340;
			}
			if (stringCheck(nft.rarity, "4")) { // Epic
				multiplier = 550;
			}
			if (stringCheck(nft.rarity, "5")) { // Legendary
				multiplier = 890;
			}
			
		}
		
		if (stringCheck(nft.nft_type, "Upgrade")) {
			
			if (stringCheck(nft.rarity, "1")) { // Common
				multiplier = 125;
			}
			if (stringCheck(nft.rarity, "2")) { // Uncommon
				multiplier = 155;
			}
			if (stringCheck(nft.rarity, "3")) { // Rare
				multiplier = 210;
			}
			if (stringCheck(nft.rarity, "4")) { // Epic
				multiplier = 325;
			}
			if (stringCheck(nft.rarity, "5")) { // Legendary
				multiplier = 495;
			}
			
		}
		
		return multiplier;
		
    }
	
	
    function getNFTAirdrops(ConsoleNFT memory nft) public pure returns (uint) {
		
		uint airdrops;
		
		if (stringCheck(nft.nft_type, "Upgrade")) {
			
			airdrops = stringToUint(nft.airdrops);
			
		}
		
		return airdrops;
		
    }
	
	// Helpers
	function stringCheck(string memory a, string memory b) public pure returns (bool) {
        return keccak256(abi.encodePacked(a)) == keccak256(abi.encodePacked(b));
    }
	
	function stringToUint(string memory s) public pure returns (uint) {
        bytes memory b = bytes(s);
        uint result = 0;
        for (uint256 i = 0; i < b.length; i++) {
            uint256 c = uint256(uint8(b[i]));
            if (c >= 48 && c <= 57) {
                result = result * 10 + (c - 48);
            }
        }
        return result;
    }

}