const { expect } = require("chai");
const { ethers } = require("hardhat");
const {utils, BigNumber} = require('ethers');
const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');

// Helper
function packObjects(objects) {
		
	var joined = "";
	
	for (let i = 0; i < objects.length; i++) {
		
		Object.keys(objects[i]).forEach(function(key,index) {
			joined += objects[i][key];
		});
		
	}
	
	return joined;
}

describe("Console Credits Tests", function () {
	
  let owner,whitelistPerson,whitelistPerson_2,whitelistPerson_3,whitelistPerson_4,randomPerson;
  let ALLOWED_ROLE;
  
  // Console Credits
  let creditsContractFactory;
  let creditsContract;
  
  // Console Credits Resolver V1
  let resolverContractFactory;
  let resolverContract;
  
  // Vaults and Upgrades
  let vaultObjects;
  let upgradeObjects;
  
  // Merkle Tree data
  let rootHash;
  let merkleProofData;
  let leafNodes;
  let merkleTree;
  
  beforeEach(async function () {
    
	[owner,whitelistPerson,whitelistPerson_2,whitelistPerson_3,whitelistPerson_4,randomPerson] = await hre.ethers.getSigners();
	
	// Deploy Console Credits
    creditsContractFactory = await hre.ethers.getContractFactory("Console_Credits");
    creditsContract = await creditsContractFactory.deploy();
    await creditsContract.deployed();
    console.log("Console Credits contract deployed to:", creditsContract.address);
	
	// Deploy Resolver with Credits address as constructor arg
	resolverContractFactory = await hre.ethers.getContractFactory("Console_Credits_Resolver_V1");
    resolverContract = await resolverContractFactory.deploy(creditsContract.address);
    await resolverContract.deployed();
    console.log("Console Credits Resolver V1 contract deployed to:", resolverContract.address);
	
	// Contract Role set up
	ALLOWED_ROLE = hre.ethers.utils.id("ALLOWED_ROLE");

    await creditsContract.grantRole(ALLOWED_ROLE,resolverContract.address);
	
	
	// Set up merkle trees
	
	// whitelistPerson has 1000 tokens and no NFTs
	// whitelistPerson_2 has 1000 tokens and a Vault
	// whitelistPerson_3 has 1000 tokens and an Upgrade
	// whitelistPerson_4 has 1000 tokens, 2x Vault and 2x Upgrade
	// randomPerson has nothing
	
	// keccak256(abi.encodePacked(msg.sender, _baseValueString, packedNFTs));
	vaultObjects = [{
		token_id:'0',
		nft_type:'Vault',
		rarity:"1",
		airdrops:"0"
	},{
		token_id:'1',
		nft_type:'Vault',
		rarity:"5",
		airdrops:"0"
	}];
	
	upgradeObjects = [{
		token_id:'2',
		nft_type:'Upgrade',
		rarity:"1",
		airdrops:"2"
	},{
		token_id:'3',
		nft_type:'Upgrade',
		rarity:"5",
		airdrops:"3"
	}];
	
	// Convert to String
	merkleProofData = [
		whitelistPerson.address.toLowerCase() + "1000", // Has 1000 tokens
		whitelistPerson_2.address.toLowerCase() + "1000" + packObjects([vaultObjects[0]]), // Has single Vault
		whitelistPerson_3.address.toLowerCase() + "1000" + packObjects([upgradeObjects[0]]), // Has single Upgrade
		whitelistPerson_4.address.toLowerCase() + "1000" + packObjects(vaultObjects) + packObjects(upgradeObjects) // Has 2x Vault and 2x Upgrade
	]
	
	leafNodes = merkleProofData.map(data => ethers.utils.keccak256(ethers.utils.toUtf8Bytes(data)));
	merkleTree = new MerkleTree(leafNodes, keccak256, { sortPairs: true });

	rootHash = merkleTree.getRoot();
	
	// Push rootHash to Resolver contract
	await resolverContract.connect(owner).setRootHash(rootHash);
	
	
  });
	
	
  it("Should claim 1000 tokens by whitelistPerson", async function () {
	
	let claimingAddress = leafNodes[0]; // 0 is whitelistPerson
	let hexProof = merkleTree.getHexProof(claimingAddress);
	
	let mintTokens = await resolverContract.connect(whitelistPerson).mintTokens(hexProof, 1000, []);
	await mintTokens.wait();
	
	// Check balance of whitelistPerson after the claim
	let balanceOf = await creditsContract.balanceOf(whitelistPerson.address);
    console.log("Balance of: " + whitelistPerson.address + " is " + balanceOf);
	
  });
	
  it("Should claim 1000 tokens by whitelistPerson_2 with multipliers from single Vault", async function () {
	
	let claimingAddress = leafNodes[1]; // 1 is whitelistPerson_2
	let hexProof = merkleTree.getHexProof(claimingAddress);
	
	console.log(merkleProofData[1]); // Merged data into a long string from mysql table
	
	let mintTokens = await resolverContract.connect(whitelistPerson_2).mintTokens(hexProof, 1000, [vaultObjects[0]]);
	await mintTokens.wait();
	
	// Check balance of whitelistPerson_2 after the claim
	let balanceOf = await creditsContract.balanceOf(whitelistPerson_2.address);
    console.log("Balance of: " + whitelistPerson_2.address + " is " + balanceOf);
	
  });
  
  it("Should claim 1000 tokens by whitelistPerson_3 with multipliers from single Upgrade", async function () {
	
	let claimingAddress = leafNodes[2]; // 2 is whitelistPerson_3
	let hexProof = merkleTree.getHexProof(claimingAddress);
	
	console.log(merkleProofData[2]);
	
	let mintTokens = await resolverContract.connect(whitelistPerson_3).mintTokens(hexProof, 1000, [upgradeObjects[0]]);
	await mintTokens.wait();
	
	// Check balance of whitelistPerson_2 after the claim
	let balanceOf = await creditsContract.balanceOf(whitelistPerson_3.address);
    console.log("Balance of: " + whitelistPerson_3.address + " is " + balanceOf);
	
  });
  
  it("Should claim 1000 tokens by whitelistPerson_4 with multipliers from Vaults and Upgrades", async function () {
	
	let claimingAddress = leafNodes[3]; // 2 is whitelistPerson_4
	let hexProof = merkleTree.getHexProof(claimingAddress);
	
	console.log(merkleProofData[3]);
	
	let joinedObjects = vaultObjects.concat(upgradeObjects);
	
	console.log(joinedObjects);
	
	let mintTokens = await resolverContract.connect(whitelistPerson_4).mintTokens(hexProof, 1000, joinedObjects);
	await mintTokens.wait();
	
	// Check balance of whitelistPerson_2 after the claim
	let balanceOf = await creditsContract.balanceOf(whitelistPerson_4.address);
    console.log("Balance of: " + whitelistPerson_4.address + " is " + balanceOf);
	
  });
  
  
  it("Should try to claim 2x from single person with the same data", async function () {
	
	let claimingAddress = leafNodes[0]; // 0 is whitelistPerson
	let hexProof = merkleTree.getHexProof(claimingAddress);
	
	let mintTokens = await resolverContract.connect(whitelistPerson).mintTokens(hexProof, 1000, []);
	await mintTokens.wait();
	
	// Check balance of whitelistPerson after the claim
	let balanceOf = await creditsContract.balanceOf(whitelistPerson.address);
    console.log("Balance after the first claim: " + whitelistPerson.address + " is " + balanceOf);
	
	// Try to claim twice
	mintTokens = await resolverContract.connect(whitelistPerson).mintTokens(hexProof, 1000, []);
	await mintTokens.wait();
	
	// Check balance of whitelistPerson after the claim
	let balanceOfSecond = await creditsContract.balanceOf(whitelistPerson.address);
    console.log("Balance after the second claim: " + whitelistPerson.address + " is " + balanceOfSecond);
	
	expect(balanceOfSecond).to.equal(balanceOf);
	
  });
  
  it("Should claim Airdrop tokens using an Upgrade", async function () {
	
	let claimingAddress = leafNodes[2]; // 2 is whitelistPerson_3
	let hexProof = merkleTree.getHexProof(claimingAddress);
	
	let mintTokens = await resolverContract.connect(whitelistPerson_3).claimAirdrop(hexProof, 1000, [upgradeObjects[0]]);
	await mintTokens.wait();
	
	// Check balance of whitelistPerson after the claim
	let balanceOf = await creditsContract.balanceOf(whitelistPerson_3.address);
    console.log("Balance after the first claim: " + whitelistPerson_3.address + " is " + balanceOf);
	
  });
  
  it("Should try to claim Airdrop tokens using an Upgrade twice and fail", async function () {
	
	let claimingAddress = leafNodes[2]; // 2 is whitelistPerson_3
	let hexProof = merkleTree.getHexProof(claimingAddress);
	
	let mintTokens = await resolverContract.connect(whitelistPerson_3).claimAirdrop(hexProof, 1000, [upgradeObjects[0]]);
	await mintTokens.wait();
	
	// Check balance of whitelistPerson after the claim
	let balanceOf = await creditsContract.balanceOf(whitelistPerson_3.address);
    console.log("Balance after the first claim: " + whitelistPerson_3.address + " is " + balanceOf);
	
	// Try to claim twice
	await expect(resolverContract.connect(whitelistPerson_3).claimAirdrop(hexProof, 1000, [upgradeObjects[0]]))
          .to.be.revertedWith('Token already used in airdrop');
	
  });
  
  it("Should try to transfer tokens and fail", async function () {
	
	let claimingAddress = leafNodes[0]; // 0 is whitelistPerson
	let hexProof = merkleTree.getHexProof(claimingAddress);
	
	let mintTokens = await resolverContract.connect(whitelistPerson).mintTokens(hexProof, 1000, []);
	await mintTokens.wait();
	
	// Check balance of whitelistPerson after the claim
	let balanceOf = await creditsContract.balanceOf(whitelistPerson.address);
    console.log("Balance after claim: " + whitelistPerson.address + " is " + balanceOf);
	
	await expect(creditsContract.connect(whitelistPerson).transfer(whitelistPerson_2.address, 100))
          .to.be.revertedWith('Contract paused');
	
  });
  
  it("Should unpause contract and try to transfer tokens and succeed", async function () {
	
	let claimingAddress = leafNodes[0]; // 0 is whitelistPerson
	let hexProof = merkleTree.getHexProof(claimingAddress);
	
	let mintTokens = await resolverContract.connect(whitelistPerson).mintTokens(hexProof, 1000, []);
	await mintTokens.wait();
	
	// Check balance of whitelistPerson after the claim
	let balanceOf = await creditsContract.balanceOf(whitelistPerson.address);
    console.log("Balance after claim: " + whitelistPerson.address + " is " + balanceOf);
	
	// Unpause
	await creditsContract.connect(owner).togglePause();
	
	await creditsContract.connect(whitelistPerson).transfer(whitelistPerson_2.address, 100);
	
	let balanceOfSecond = await creditsContract.balanceOf(whitelistPerson_2.address);
    console.log("Balance after receiving tokens: " + whitelistPerson_2.address + " is " + balanceOfSecond);
	
  });
	
	
});
