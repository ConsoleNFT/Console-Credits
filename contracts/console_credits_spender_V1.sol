// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "hardhat/console.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IConsoleCredits {
  function burnTokens(address _receiver, uint _amount) external;
}

contract Console_Credits_Spender_V1 is ReentrancyGuard, Ownable {
	
    address CreditsAddress;

    IConsoleCredits public CreditsContract;

    function setTargetContract(address _setAddress) external onlyOwner {
        CreditsAddress = _setAddress;
    }

    constructor(address _CreditsAddress) {
		
		CreditsAddress = _CreditsAddress;
		
    }
	
	
    function burnTokens(uint _amount) external nonReentrant {
		
        CreditsContract = IConsoleCredits(CreditsAddress);

        CreditsContract.burnTokens(msg.sender, _amount);

    }
	
}