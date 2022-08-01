// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract Console_Credits is ERC20, ReentrancyGuard, Ownable, AccessControl {
	
	// Roles
    bytes32 public constant ALLOWED_ROLE = keccak256("ALLOWED_ROLE");

    mapping(address => uint) private claimedTokensBaseValue;
    bool public PAUSED;

    constructor() ERC20("Console Credits", "CREDITS") {
		
		_setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
		
	}

    function mintTokens(address _receiver, uint _addBaseValue, uint _tokensToMint) external nonReentrant onlyRole(ALLOWED_ROLE) {

        claimedTokensBaseValue[_receiver] += _addBaseValue;

        _mint(_receiver, _tokensToMint);

    }

    function burnTokens(address _receiver, uint _amount) external nonReentrant onlyRole(ALLOWED_ROLE) {

        _burn(_receiver, _amount);

    }

    function togglePause() external onlyOwner {
        PAUSED = !PAUSED;
    }

    // Getters
    function getNumberOfClaimedTokens(address _address) public view returns (uint) {
        
		return claimedTokensBaseValue[_address];

    }

    function transfer(address recipient, uint256 amount) public override returns (bool) {
      require(PAUSED, "Contract paused");
      _transfer(_msgSender(), recipient, amount);
      return true;
    }

}