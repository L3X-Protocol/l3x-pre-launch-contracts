// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// Import necessary components from OpenZeppelin, if needed (e.g., ERC20 interface, Ownable for admin)
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Staking Contract
 * @notice This contract allows users to stake tokens and earn rewards for staking
 * @dev Only operators can add or remove tokens acceptable for staking
 */
contract PreLaunchStaking is Ownable {
  // Define events
  event Stake(address indexed user, address indexed token, uint256 amount, uint256 time);
  event Unstake(address indexed user, address indexed token, uint256 amount, uint256 time);
  event OperatorAdded(address indexed operator);
  event OperatorRemoved(address indexed operator);
  event TokenAdded(address indexed token);
  event TokenRemoved(address indexed token);

  // Array to keep track of accepted tokens for staking.
  address[] private acceptedTokensArray;

  // Operators mapping
  mapping(address => bool) public operators;

  // Mapping to keep track of acceptable tokens
  mapping(address => bool) private acceptedTokens;

  // Mapping to keep track of user stakes
  mapping(address => mapping(address => uint256)) private userStakes;

  // Modifier to restrict access to operators
  modifier onlyOperator() {
    require(operators[msg.sender], "Not an operator");
    _;
  }
  /**
   * @notice Constructor sets the initial admin
   * @param initialOwner Address of the initial admin
   */
  constructor(address initialOwner) {
    addOperator(initialOwner);
  }

  /**
   * @notice Function to add operators by admin
   * @param _operator Address of the operator to be added
   */
  function addOperator(address _operator) public onlyOwner {
    operators[_operator] = true;
    emit OperatorAdded(_operator);
  }

  /**
   * @notice Function to remove operators by admin
   * @param _operator Address of the operator to be removed
   */
  function removeOperator(address _operator) external onlyOwner {
    operators[_operator] = false;
    emit OperatorRemoved(_operator);
  }

  /**
   * @notice Operators can add a new token to accept for staking
   * @param _token Address of the token to be added
   */
  function addToken(address _token) external onlyOperator {
    require(!acceptedTokens[_token], "addToken: Token already whitelisted");
    acceptedTokens[_token] = true;
    acceptedTokensArray.push(_token);
    emit TokenAdded(_token);
  }

  /**
   * @notice Operators can remove a token from being acceptable for staking
   * @param _token Address of the token to be removed
   */
  function removeToken(address _token) external onlyOperator {
    require(acceptedTokens[_token], "removeToken: Token not found");
    acceptedTokens[_token] = false;
    emit TokenRemoved(_token);
  }

  /**
   * @notice Users can stake their tokens
   * @param _token Address of the token to be staked
   * @param _amount Amount of the token to be staked
   */
  function stake(address _token, uint256 _amount) external {
    require(_amount > 0, "Staking: Zero amount");
    require(acceptedTokens[_token], "Staking: Token not accepted for staking");
    IERC20(_token).transferFrom(msg.sender, address(this), _amount);
    userStakes[msg.sender][_token] += _amount;
    emit Stake(msg.sender, _token, _amount, block.timestamp);
  }

  /**
   * @notice Users can unstake their tokens
   * @param _token Address of the token to be unstaked
   * @param _amount Amount of the token to be unstaked
   */
  function unstake(address _token, uint256 _amount) external {
    require(_amount > 0, "UnStaking: Zero amount");
    require(userStakes[msg.sender][_token] >= _amount, "UnStaking: Insufficient balance to unstake");
    userStakes[msg.sender][_token] -= _amount;
    IERC20(_token).transfer(msg.sender, _amount);
    emit Unstake(msg.sender, _token, _amount, block.timestamp);
  }

  /**
   * @notice A helper function to get all accepted tokens
   * @return Array of addresses representing accepted tokens
   */
  function getAllAcceptedTokens() external view returns (address[] memory) {
    address[] memory result = new address[](acceptedTokenCount());
    uint256 index = 0;
    for (uint256 i = 0; i < acceptedTokensArray.length; i++) {
      if (acceptedTokens[acceptedTokensArray[i]]) {
        result[index] = acceptedTokensArray[i];
        index++;
      }
    }
    return result;
  }

  /**
   * @notice A helper function to get the count of accepted tokens
   * @return Number of accepted tokens
   */
  function acceptedTokenCount() public view returns (uint256) {
    uint256 count = 0;
    for (uint256 i = 0; i < acceptedTokensArray.length; i++) {
      if (acceptedTokens[acceptedTokensArray[i]]) {
          count++;
      }
    }
    return count;
  }

  /**
   * @notice A helper function to get all of a user’s staked balances
   * @param _user Address of the user
   * @return Arrays of addresses and uint256 representing staked tokens and their balances
   */
  function getUserStakedBalances(address _user) external view returns (address[] memory, uint256[] memory) {
    uint256 count = acceptedTokenCount();
    address[] memory stakedTokens = new address[](count);
    uint256[] memory stakedBalances = new uint256[](count);
    uint256 index = 0;
    for (uint256 i = 0; i < acceptedTokensArray.length; i++) {
      if (acceptedTokens[acceptedTokensArray[i]]) {
        stakedTokens[index] = acceptedTokensArray[i];
        stakedBalances[index] = userStakes[_user][stakedTokens[index]];
        index++;
      }
    }
    return (stakedTokens, stakedBalances);
  }

  /**
   * @notice A helper function to get balance of a user’s one staked
   * @param _user Address of the user
   * @param _token Address of the token
   * @return uint256 representing staked balance
   * @dev This function is used to get the balance of a user’s staked token
   */
  function getUserStakedBalance(address _user, address _token) external view returns (uint256) {
    return userStakes[_user][_token];
  }
}
