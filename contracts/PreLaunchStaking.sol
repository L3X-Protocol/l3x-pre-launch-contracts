// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {Ownable2StepUpgradeable} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

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
}

/**
 * @title Staking Contract
 * @notice This contract allows users to stake tokens and earn rewards for staking
 * @dev Only owner can add or remove tokens acceptable for staking
 */
contract PreLaunchStaking is Initializable, PausableUpgradeable, Ownable2StepUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;
    using Address for address payable;

    // Array to keep track of accepted tokens for staking.
    address[] private acceptedTokensArray;
    address public bridgeProxyAddress; // Address of the bridge contract to bridge to L3

    // Mapping to keep track of acceptable tokens
    mapping(address => bool) private acceptedTokens;

    // Mapping to keep track of user stakes
    mapping(address => mapping(address => uint256)) private userStakes;

    // Mapping to keep track of staked amount
    mapping(address => uint256) public stakedAmounts;

    event Staked(address indexed user, address indexed token, uint256 amount, uint256 time);
    event Unstaked(address indexed user, address indexed token, uint256 amount, uint256 time);
    event AssetBridged(address indexed owner, address indexed token, address indexed receiver, uint256 amount);
    event BridgeAddressSet(address bridgeAddress);
    event TokenAdded(address indexed token);
    event TokenRemoved(address indexed token);

    /**
     * @dev Initialize the contract
     * @param _initialOwner Address of the initial admin
     */
    function initialize(address _initialOwner) public initializer {
        __Pausable_init();
        __Ownable_init(_initialOwner);
        __ReentrancyGuard_init();
    }

    fallback() external payable {
        revert("fallback not allowed");
    }

    receive() external payable {
        revert("receive not allowed");
    }

    /*//////////////////////////////////////////////////////////////
                        USER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Users can stake their ERC20 tokens
     * @param _token Address of the token to be staked
     * @param _amount Amount of the token to be staked
     */
    function stake(address _token, uint256 _amount) external whenNotPaused nonReentrant {
        require(_amount > 0, "Stake: Zero amount");
        require(acceptedTokens[_token], "Stake: Token not accepted for staking");
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        userStakes[msg.sender][_token] += _amount;
        stakedAmounts[_token] += _amount;
        emit Staked(msg.sender, _token, _amount, block.timestamp);
    }

    /**
     * @notice Users can unstake their ERC20 tokens
     * @param _token Address of the token to be unstaked
     * @param _amount Amount of the token to be unstaked
     */
    function unstake(address _token, uint256 _amount) external nonReentrant {
        require(_amount > 0, "Unstake: Zero amount");
        require(userStakes[msg.sender][_token] >= _amount, "Unstake: Insufficient balance to unstake");
        userStakes[msg.sender][_token] -= _amount;
        stakedAmounts[_token] -= _amount;
        IERC20(_token).safeTransfer(msg.sender, _amount);
        emit Unstaked(msg.sender, _token, _amount, block.timestamp);
    }

    /**
     * @notice Allow users to bridge their assets to L3 after the bridge is established
     * @param _token Address of the token to bridge
     * @param _minGasLimit Minimum gas limit for each individual withdrawal transaction
     * @param _receiver The receiver of the funds on L3
     */
    function bridgeAsset(address _token, uint32 _minGasLimit, address _receiver) external whenNotPaused nonReentrant {
        address bridgeAddress = bridgeProxyAddress;
        require(bridgeAddress != address(0), "Bridge not ready");
        uint256 transferAmount = userStakes[msg.sender][_token];
        require(transferAmount != 0, "Withdrawal completed or token never staked");
        require(acceptedTokens[_token], "token not accepted");

        userStakes[msg.sender][_token] = 0;
        stakedAmounts[_token] -= transferAmount;

        // bridge ERC20 token
        IERC20(_token).approve(bridgeAddress, transferAmount);
        BridgeInterface(bridgeAddress).depositERC20To(_token, _receiver, transferAmount, _minGasLimit, hex"");

        emit AssetBridged(msg.sender, _token, _receiver, transferAmount);
    }

    /*//////////////////////////////////////////////////////////////
                        VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

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
        for (uint256 i = 0; i < acceptedTokensArray.length; ++i) {
            if (acceptedTokens[acceptedTokensArray[i]]) {
                ++count;
            }
        }
        return count;
    }

    /**
     * @notice A helper function to get all of a user’s all staked balances, including unaccepted
     * @param _user Address of the user
     * @return stakedTokens Array of token addresses
     * @return stakedBalances Array of staked balances
     */
    function getUserStakedBalances(
        address _user
    ) external view returns (address[] memory stakedTokens, uint256[] memory stakedBalances) {
        uint256 length = acceptedTokensArray.length;
        stakedTokens = acceptedTokensArray;
        stakedBalances = new uint256[](length);

        for (uint256 i = 0; i < length; ++i) {
            stakedBalances[i] = userStakes[_user][stakedTokens[i]];
        }
    }

    /**
     * @notice A helper function to get all of a user’s all accepted staked balances
     * @param _user Address of the user
     * @return stakedTokens Array of token addresses
     * @return stakedBalances Array of staked balances
     */
    function getUserAcceptedStakedBalances(
        address _user
    ) external view returns (address[] memory stakedTokens, uint256[] memory stakedBalances) {
        uint256 count = acceptedTokenCount();
        stakedTokens = new address[](count);
        stakedBalances = new uint256[](count);

        uint256 index = 0;
        for (uint256 i = 0; i < acceptedTokensArray.length; ++i) {
            address acceptedToken = acceptedTokensArray[i];
            if (acceptedTokens[acceptedToken]) {
                stakedTokens[index] = acceptedToken;
                stakedBalances[index] = userStakes[_user][acceptedToken];
                ++index;
            }
        }
    }

    /**
     * @notice A helper function to get the balance of a user’s staked token
     * @param _user Address of the user
     * @param _token Address of the token
     * @return uint256 representing staked balance
     */
    function getUserTokenStakedBalance(address _user, address _token) external view returns (uint256) {
        return userStakes[_user][_token];
    }

    /*//////////////////////////////////////////////////////////////
                        ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Function to set the address of the bridge proxy.
     * @param _bridgeProxyAddress Address of the bridge proxy contract.
     */
    function setBridgeAddress(address _bridgeProxyAddress) external onlyOwner {
        bridgeProxyAddress = _bridgeProxyAddress;
        emit BridgeAddressSet(bridgeProxyAddress);
    }

    /**
     * @dev Owner can add a new token to accept for staking.
     * @param _token Address of the token to be added.
     */
    function addToken(address _token) external onlyOwner {
        require(!acceptedTokens[_token], "addToken: token already whitelisted");
        _addToken(_token);
    }

    function _addToken(address _token) internal {
        acceptedTokens[_token] = true;
        acceptedTokensArray.push(_token);
        emit TokenAdded(_token);
    }

    /**
     * @dev Owner can remove a token from being acceptable for staking.
     * @param _token Address of the token to be removed.
     */
    function removeToken(address _token) external onlyOwner {
        require(acceptedTokens[_token], "removeToken: token not whitelisted");
        acceptedTokens[_token] = false;
        emit TokenRemoved(_token);
    }

    /**
     * @dev Function to rescue redundant ERC20 tokens locked in contract.
     * @param _token Address of the ERC20 token to be rescued.
     */
    function rescueToken(address _token) external onlyOwner {
        uint256 amount = IERC20(_token).balanceOf(address(this)) - stakedAmounts[_token];
        require(amount > 0, "nothing to rescue");
        IERC20(_token).safeTransfer(owner(), amount);
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
}
