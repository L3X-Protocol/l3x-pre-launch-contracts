// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Import necessary components from OpenZeppelin, if needed (e.g., ERC20 interface, Ownable for admin)
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface BridgeInterface {
  /**
   * @dev reference: https://github.com/ethereum-optimism/optimism/blob/65ec61dde94ffa93342728d324fecf474d228e1f/packages/contracts-bedrock/contracts/L1/L1StandardBridge.sol#L188
   */
  function depositERC20To(
      address _token,
      address _to,
      uint256 _amount,
      uint32 _minGasLimit,
      bytes calldata _extraData
  ) external;

  /**
   * @dev reference: https://github.com/ethereum-optimism/optimism/blob/65ec61dde94ffa93342728d324fecf474d228e1f/packages/contracts-bedrock/contracts/L1/L1StandardBridge.sol#L137
   */
  function depositETHTo(address _to, uint32 _minGasLimit, bytes calldata _extraData) external payable;
}

/**
 * @title Staking Contract
 * @notice This contract allows users to stake tokens and earn rewards for staking
 * @dev Only operators can add or remove tokens acceptable for staking
 */
contract PreLaunchStaking is Ownable, Pausable, ReentrancyGuard {

  using SafeERC20 for IERC20;
  using Address for address payable;

  // Constant representing the Ethereum token address.
  address public constant ETH_TOKEN_ADDRESS = address(0x00);

  // Define events
  event Stake(address indexed user, address indexed token, uint256 amount, uint256 time);
  event Unstake(address indexed user, address indexed token, uint256 amount, uint256 time);
  event OperatorAdded(address indexed operator);
  event OperatorRemoved(address indexed operator);
  event TokenAdded(address indexed token);
  event TokenRemoved(address indexed token);
  event BridgeAddress(address bridgeProxyAddress);
  event BridgeAsset(address indexed owner, address indexed token, address indexed receiver, uint256 amount);
  // Array to keep track of accepted tokens for staking.
  address[] private acceptedTokensArray;
  address public bridgeProxyAddress; // Address of the bridge contract to bridge to L3

  // Mapping to keep track of acceptable tokens
  mapping(address => bool) private acceptedTokens;

  // Mapping to keep track of user stakes
  mapping(address => mapping(address => uint256)) private userStakes;

  /**
   * @notice Constructor sets the initial admin
   * @param initialOwner Address of the initial admin
   */
  constructor(address initialOwner) Ownable(initialOwner)
  {  
    _addToken(ETH_TOKEN_ADDRESS);
  }

  /**
   * @dev Function to set the address of the bridge proxy.
   * This function allows the contract owner to set the address of the bridge proxy for token transfers between Layer 1 and Layer 2.
   * @param _bridgeProxyAddress Address of the bridge proxy contract.
   */
  function setBridgeProxyAddress(address _bridgeProxyAddress) external onlyOwner {
      bridgeProxyAddress = _bridgeProxyAddress;
      emit BridgeAddress(bridgeProxyAddress);
  }

  /**
   * @dev Internal function to withdraw tokens to Layer 2.
   * @param token Address of the token to withdraw.
   * @param minGasLimit Minimum gas limit for each individual withdrawal transaction.
   * @param receiver The receiver of the funds on L2.
   */
  function bridgeAsset(address token, uint32 minGasLimit, address receiver) external whenNotPaused nonReentrant  {
      require(bridgeProxyAddress != address(0), "Bridge not ready");
      uint256 transferAmount = userStakes[msg.sender][token];
      require(transferAmount != 0, "Withdrawal completed or token never staked");

      // check l2 token address set.
      require(token == ETH_TOKEN_ADDRESS || acceptedTokens[token] == true, "token not accepted");

      address bridgeAddress = bridgeProxyAddress;

      userStakes[msg.sender][token] = 0;

      if (token == ETH_TOKEN_ADDRESS) {
          // Bridge Ether to Layer 2.
          BridgeInterface(bridgeAddress).depositETHTo{value: transferAmount}(receiver, minGasLimit, hex"");
      } else {
          // Approve tokens for transfer to the bridge.
          IERC20(token).approve(bridgeAddress, transferAmount);
          // Bridge ERC20 tokens to Layer 2.
          BridgeInterface(bridgeAddress).depositERC20To(
              token, receiver, transferAmount, minGasLimit, hex""
          );
      }
      emit BridgeAsset(msg.sender, token, receiver, transferAmount);
  }

  /**
   * @notice Owner can add a new token to accept for staking
   * @param _token Address of the token to be added
   */
  function addToken(address _token) external onlyOwner {
    require(!acceptedTokens[_token], "addToken: Token already whitelisted");
    _addToken(_token);
  }

  function _addToken(address _token) internal {
    acceptedTokens[_token] = true;
    acceptedTokensArray.push(_token);
    emit TokenAdded(_token);
  }

  /**
   * @notice Owner can remove a token from being acceptable for staking
   * @param _token Address of the token to be removed
   */
  function removeToken(address _token) external onlyOwner {
    require(acceptedTokens[_token], "removeToken: Token not found");
    acceptedTokens[_token] = false;
    emit TokenRemoved(_token);
  }

  /**
   * @notice Users can stake their ETH
   */
  function stakeETH() external payable whenNotPaused nonReentrant {
    userStakes[msg.sender][ETH_TOKEN_ADDRESS] += msg.value;
    emit Stake(msg.sender, ETH_TOKEN_ADDRESS, msg.value, block.timestamp);
  }

  /**
   * @notice Users can unstake their ETH
   */
  function unstakeETH(uint256 _amount) external whenNotPaused nonReentrant {
    require(_amount > 0, "UnStaking: Zero amount");
    require(userStakes[msg.sender][ETH_TOKEN_ADDRESS] >= _amount, "UnStaking: Insufficient balance to unstake");
    userStakes[msg.sender][ETH_TOKEN_ADDRESS] -= _amount;
    payable(msg.sender).sendValue(_amount);
    emit Unstake(msg.sender, ETH_TOKEN_ADDRESS, _amount, block.timestamp);
  }

  /**
   * @notice Users can stake their tokens
   * @param _token Address of the token to be staked
   * @param _amount Amount of the token to be staked
   */
  function stake(address _token, uint256 _amount) external whenNotPaused nonReentrant {
    require(_token != address(0), "Use stakeETH");
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
  function unstake(address _token, uint256 _amount) external whenNotPaused nonReentrant {
    require(_token != address(0), "Use unstakeETH");
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

  /**
   * @dev Function to pause contract. This calls the Pausable contract.
   */
  function pause() external onlyOwner {
      super._pause();
  }

  /**
   * @dev Function to unpause contract. This calls the Pausable contract.
   */
  function unpause() external onlyOwner {
      super._unpause();
  }

  /**
   * @dev Get the Ether balance of the contract
   * @return uint256 Ether balance of the contract
   */
  function getEthBalance() public view returns (uint256) {
      return address(this).balance;
  }

  fallback() external payable {
    revert("fallback not allowed");
  }

  receive() external payable {
    revert("receive not allowed");
  }

}
