import { expect, assert } from "chai";
import { ethers, network } from "hardhat";
import {
  PreLaunchStaking,
  PreLaunchStaking__factory,
  TokenStaking,
  TokenStaking__factory,
} from "../../typechain-types";

// Function
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

// Data
import {
  REWARD_AMOUNT,
  STAKING_AMOUNT,
  EXCCESS_STAKING_AMOUNT,
  developmentChains,
} from "../../helper-hardhat-config";

// Types
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

// import { BigNumber, Block } from "ethers";
import { BigNumberish } from "ethers";
import { ContractTransactionResponse, ContractTransactionReceipt } from "ethers";

// ------------

describe("PreLaunchStaking", function () {
  beforeEach(async () => {
    if (!developmentChains.includes(network.name)) {
      throw new Error(
        "You need to be on a development chain to run unit tests"
      );
    }
  });

  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  type DeployFixture = {
    deployer: SignerWithAddress;
    preLaunchStaking: PreLaunchStaking;
    tokenStaking: TokenStaking;
    secondTokenStaking: TokenStaking;
  };
  async function deployPreLaunchStakingFixture(): Promise<DeployFixture> {
    const [deployer]: SignerWithAddress[] = await ethers.getSigners();

    const tokenStakingFactory: TokenStaking__factory =
      await ethers.getContractFactory("TokenStaking", deployer);

    const tokenStaking: TokenStaking = await tokenStakingFactory.deploy();
    await tokenStaking.waitForDeployment();

    const secondTokenStaking: TokenStaking = await tokenStakingFactory.deploy();
    await secondTokenStaking.waitForDeployment();


    const preLaunchStakingFactory: PreLaunchStaking__factory =
      await ethers.getContractFactory("PreLaunchStaking", deployer);
    const preLaunchStaking: PreLaunchStaking = await preLaunchStakingFactory.deploy(deployer.address);
    await preLaunchStaking.waitForDeployment();

    preLaunchStaking.addToken(tokenStaking.getAddress());
    return { deployer, preLaunchStaking, tokenStaking, secondTokenStaking };
  }


  async function mintTokens(
    preLaunchStaking: PreLaunchStaking,
    token: TokenStaking,
    isStakingToken: boolean
  ) {
    await token.mint(REWARD_AMOUNT);
    await token.transfer(preLaunchStaking.getAddress(), REWARD_AMOUNT);

    return token;
  }


  async function mintAndStake(
    preLaunchStaking: PreLaunchStaking,
    tokenStaking: TokenStaking,
    staker: SignerWithAddress
  ) {
    await tokenStaking.connect(staker).mint(STAKING_AMOUNT);
    await tokenStaking
      .connect(staker)
      .approve(preLaunchStaking.getAddress(), STAKING_AMOUNT);
    await preLaunchStaking.connect(staker).stake(tokenStaking.getAddress(), STAKING_AMOUNT);
  }


  describe("Constructor", function () {
    it("should initialize the deployer address as the operator successfully", async function () {
      const { deployer, preLaunchStaking, tokenStaking } = await loadFixture(
        deployPreLaunchStakingFixture
      );

      const isOperator = await preLaunchStaking.operators(
        deployer.address
      );
      // check if isOperator is true
      assert.equal(isOperator, true);
    });
  });


  describe("#stake", function () {
    it("should emit `stake` event on successful staking", async function () {
      const [, staker]: SignerWithAddress[] = await ethers.getSigners();
      const { deployer, preLaunchStaking, tokenStaking } =
        await loadFixture(deployPreLaunchStakingFixture);
      await tokenStaking.connect(staker).mint(STAKING_AMOUNT);
      await tokenStaking
        .connect(staker)
        .approve(preLaunchStaking.getAddress(), STAKING_AMOUNT);

      const tx: ContractTransactionResponse =  
        await preLaunchStaking
          .connect(staker)
          .stake(tokenStaking.getAddress(), STAKING_AMOUNT);

      const txReceipt = await tx.wait(1) as ContractTransactionReceipt;

      const blockNumber = txReceipt.blockNumber;
      
      const block = await ethers.provider.getBlock(blockNumber);
      const currentTimestamp = block?.timestamp;
      
      await expect(tx).to.emit(preLaunchStaking, "Stake").withArgs(staker.address, tokenStaking.getAddress(), STAKING_AMOUNT, currentTimestamp);
    });

    it("should transfer tokens from `staker` to the contract", async function () {
      const [, staker]: SignerWithAddress[] = await ethers.getSigners();

      const { deployer, preLaunchStaking, tokenStaking } =
        await loadFixture(deployPreLaunchStakingFixture);

      await mintAndStake(preLaunchStaking, tokenStaking, staker);

      const contractBalance: BigNumberish = await tokenStaking
        .connect(staker)
        .balanceOf(preLaunchStaking.getAddress());
      assert.equal(contractBalance.toString(), STAKING_AMOUNT.toString());
    });

    it("should increase the balance of the staker in the contract", async function () {
      const [, staker]: SignerWithAddress[] = await ethers.getSigners();
      const { deployer, preLaunchStaking, tokenStaking } =
        await loadFixture(deployPreLaunchStakingFixture);

      await mintAndStake(preLaunchStaking, tokenStaking, staker);

      const stakerBalance: BigNumberish = await preLaunchStaking
        .connect(staker)
        .getUserStakedBalance(staker.getAddress(), tokenStaking.getAddress());
      assert.equal(stakerBalance.toString(), STAKING_AMOUNT.toString());
    });

    it("reverts if the amount equals zero", async function () {
      const [, staker]: SignerWithAddress[] = await ethers.getSigners();
      const { deployer, preLaunchStaking, tokenStaking } =
        await loadFixture(deployPreLaunchStakingFixture);

      await tokenStaking.connect(staker).mint(STAKING_AMOUNT);
      await tokenStaking
        .connect(staker)
        .approve(preLaunchStaking.getAddress(), STAKING_AMOUNT);

      await expect(
        preLaunchStaking.connect(staker).stake(tokenStaking.getAddress(), 0)
      ).to.be.revertedWith(
        "Staking: Zero amount"
      );
    });

    it("reverts if the token is not in the whitelist", async function () {
      const [, staker]: SignerWithAddress[] = await ethers.getSigners();
      const { deployer, preLaunchStaking, tokenStaking, secondTokenStaking } =
        await loadFixture(deployPreLaunchStakingFixture);

      await tokenStaking.connect(staker).mint(STAKING_AMOUNT);
      await tokenStaking
        .connect(staker)
        .approve(preLaunchStaking.getAddress(), STAKING_AMOUNT);

      await expect(
        preLaunchStaking.connect(staker).stake(secondTokenStaking.getAddress(), STAKING_AMOUNT)
      ).to.be.revertedWith(
        "Staking: Token not accepted for staking"
      );
    });

  });

  describe("#unstake", function () {
    it("should emit `unstake` event on successful unstaking", async function () {
      const [, staker]: SignerWithAddress[] = await ethers.getSigners();
      const { deployer, preLaunchStaking, tokenStaking } =
        await loadFixture(deployPreLaunchStakingFixture);
      await mintAndStake(preLaunchStaking, tokenStaking, staker);

      const tx: ContractTransactionResponse =  
        await preLaunchStaking
          .connect(staker)
          .unstake(tokenStaking.getAddress(), STAKING_AMOUNT);

      const txReceipt = await tx.wait(1) as ContractTransactionReceipt;

      const blockNumber = txReceipt.blockNumber;
      
      const block = await ethers.provider.getBlock(blockNumber);
      const currentTimestamp = block?.timestamp;
      
      await expect(tx).to.emit(preLaunchStaking, "Unstake").withArgs(staker.address, tokenStaking.getAddress(), STAKING_AMOUNT, currentTimestamp);
    });

    it("should transfer tokens from the contract to the `staker`", async function () {
      const [, staker]: SignerWithAddress[] = await ethers.getSigners();
      const { deployer, preLaunchStaking, tokenStaking } =
        await loadFixture(deployPreLaunchStakingFixture);
      await mintAndStake(preLaunchStaking, tokenStaking, staker);


      await preLaunchStaking.connect(staker).unstake(tokenStaking.getAddress(), STAKING_AMOUNT);

      const contractBalance: BigNumberish = await tokenStaking.balanceOf(
        preLaunchStaking.getAddress()
      );
      assert.equal(contractBalance.toString(), "0");
    });

    it("should decrease the balance of the staker in the contract", async function () {
      const [, staker]: SignerWithAddress[] = await ethers.getSigners();
      const { deployer, preLaunchStaking, tokenStaking } =
        await loadFixture(deployPreLaunchStakingFixture);

      await mintAndStake(preLaunchStaking, tokenStaking, staker);

      await preLaunchStaking.connect(staker).unstake(tokenStaking.getAddress(), STAKING_AMOUNT);
      const stakerBalance: BigNumberish = await preLaunchStaking.getUserStakedBalance(
        staker,
        tokenStaking.getAddress()
      );
      assert.equal(stakerBalance.toString(), "0");
    });

    it("reverts if the amount equals zero", async function () {
      const [, staker]: SignerWithAddress[] = await ethers.getSigners();
      const { deployer, preLaunchStaking, tokenStaking } =
        await loadFixture(deployPreLaunchStakingFixture);

      await mintAndStake(preLaunchStaking, tokenStaking, staker);

      await expect(
        preLaunchStaking.connect(staker).unstake(tokenStaking.getAddress(), 0)
      ).to.be.revertedWith(
        "UnStaking: Zero amount"
      );
    });

    it("reverts if the user's unstaking amount is insufficient", async function () {
      const [, staker]: SignerWithAddress[] = await ethers.getSigners();
      const { deployer, preLaunchStaking, tokenStaking } =
        await loadFixture(deployPreLaunchStakingFixture);

      await mintAndStake(preLaunchStaking, tokenStaking, staker);

      await expect(
        preLaunchStaking.connect(staker).unstake(tokenStaking.getAddress(), EXCCESS_STAKING_AMOUNT)
      ).to.be.revertedWith(
        "UnStaking: Insufficient balance to unstake"
      );
    });
  });

  describe("#tokenWhitelist", function () {
    it("reverts if the caller  is not operator", async function () {
      const [, staker]: SignerWithAddress[] = await ethers.getSigners();
      const { deployer, preLaunchStaking, tokenStaking, secondTokenStaking } =
        await loadFixture(deployPreLaunchStakingFixture);

      await expect(
          preLaunchStaking.connect(staker).addToken(secondTokenStaking.getAddress())
        ).to.be.revertedWith(
          "Not an operator"
        );

      await expect(
          preLaunchStaking.connect(staker).removeToken(tokenStaking.getAddress())
        ).to.be.revertedWith(
          "Not an operator"
        );
    });

    it("should emit `TokenAdded` event on successful unstaking", async function () {
      const { deployer, preLaunchStaking, tokenStaking, secondTokenStaking } =
        await loadFixture(deployPreLaunchStakingFixture);

      const tx: ContractTransactionResponse =  
        await preLaunchStaking
          .connect(deployer)
          .addToken(secondTokenStaking.getAddress());

      const txReceipt = await tx.wait(1) as ContractTransactionReceipt;

      const blockNumber = txReceipt.blockNumber;
      
      const block = await ethers.provider.getBlock(blockNumber);
      const currentTimestamp = block?.timestamp;
      
      await expect(tx).to.emit(preLaunchStaking, "TokenAdded").withArgs(secondTokenStaking.getAddress());
    });

    it("should emit `TokenRemoved` event on successful unstaking", async function () {
      const { deployer, preLaunchStaking, tokenStaking, secondTokenStaking } =
        await loadFixture(deployPreLaunchStakingFixture);

      const tx: ContractTransactionResponse =  
        await preLaunchStaking
          .connect(deployer)
          .removeToken(tokenStaking.getAddress());

      const txReceipt = await tx.wait(1) as ContractTransactionReceipt;

      const blockNumber = txReceipt.blockNumber;
      
      const block = await ethers.provider.getBlock(blockNumber);
      const currentTimestamp = block?.timestamp;
      
      await expect(tx).to.emit(preLaunchStaking, "TokenRemoved").withArgs(tokenStaking.getAddress());
    });

    it("reverts if Token already whitelisted", async function () {
      const { deployer, preLaunchStaking, tokenStaking, secondTokenStaking } =
        await loadFixture(deployPreLaunchStakingFixture);

      await expect(
          preLaunchStaking.connect(deployer).addToken(tokenStaking.getAddress())
        ).to.be.revertedWith(
          "addToken: Token already whitelisted"
        );
    });

    it("reverts if Token not found", async function () {
      const { deployer, preLaunchStaking, tokenStaking, secondTokenStaking } =
        await loadFixture(deployPreLaunchStakingFixture);

      await expect(
          preLaunchStaking.connect(deployer).removeToken(secondTokenStaking.getAddress())
        ).to.be.revertedWith(
          "removeToken: Token not found"
        );
    });
  });

  describe("#operatorWhitelist", function () {
    it("reverts if the caller is not owner", async function () {
      const [, user1]: SignerWithAddress[] = await ethers.getSigners();
      const [, user2]: SignerWithAddress[] = await ethers.getSigners();
      const { deployer, preLaunchStaking, tokenStaking, secondTokenStaking } =
        await loadFixture(deployPreLaunchStakingFixture);

      await expect(
          preLaunchStaking.connect(user1).addOperator(user2.getAddress())
        ).to.be.revertedWith(
          "Ownable: caller is not the owner"
        );
      await expect(
          preLaunchStaking.connect(user1).addOperator(deployer.getAddress())
        ).to.be.revertedWith(
          "Ownable: caller is not the owner"
        );
    });

    it("operator should be able to add a token ", async function () {
      const [, operator]: SignerWithAddress[] = await ethers.getSigners();
      const { deployer, preLaunchStaking, tokenStaking, secondTokenStaking } =
        await loadFixture(deployPreLaunchStakingFixture);

      const tx: ContractTransactionResponse =  
        await preLaunchStaking
          .connect(deployer)
          .addOperator(operator.getAddress());

      const tx_addtoken: ContractTransactionResponse =  
          await preLaunchStaking
            .connect(operator)
            .addToken(secondTokenStaking.getAddress());
        
      await expect(tx_addtoken).to.emit(preLaunchStaking, "TokenAdded").withArgs(secondTokenStaking.getAddress());

      const allAcceptedTokens = await preLaunchStaking.getAllAcceptedTokens();
      const secondTokenStakingAddress = await secondTokenStaking.getAddress();
      assert.include(allAcceptedTokens, secondTokenStakingAddress);
      
    });

    it("should emit `OperatorAdded` event on successful addOperator", async function () {
      const [, operator]: SignerWithAddress[] = await ethers.getSigners();
      const { deployer, preLaunchStaking, tokenStaking, secondTokenStaking } =
        await loadFixture(deployPreLaunchStakingFixture);

      const tx: ContractTransactionResponse =  
        await preLaunchStaking
          .connect(deployer)
          .addOperator(operator.getAddress());

      const txReceipt = await tx.wait(1) as ContractTransactionReceipt;

      const blockNumber = txReceipt.blockNumber;
      
      const block = await ethers.provider.getBlock(blockNumber);
      const currentTimestamp = block?.timestamp;
      
      await expect(tx).to.emit(preLaunchStaking, "OperatorAdded").withArgs(operator.getAddress());
    });

    it("should emit `OperatorAdded` event on successful addOperator", async function () {
      const [, operator]: SignerWithAddress[] = await ethers.getSigners();
      const { deployer, preLaunchStaking, tokenStaking, secondTokenStaking } =
        await loadFixture(deployPreLaunchStakingFixture);

      const tx: ContractTransactionResponse =  
        await preLaunchStaking
          .connect(deployer)
          .removeOperator(operator.getAddress());

      const txReceipt = await tx.wait(1) as ContractTransactionReceipt;

      const blockNumber = txReceipt.blockNumber;
      
      const block = await ethers.provider.getBlock(blockNumber);
      const currentTimestamp = block?.timestamp;
      
      await expect(tx).to.emit(preLaunchStaking, "OperatorRemoved").withArgs(operator.getAddress());
    });
  });

  describe("#userBalance", function () {
    it("return user staked balance", async function () {
      const [, staker]: SignerWithAddress[] = await ethers.getSigners();
      const { deployer, preLaunchStaking, tokenStaking, secondTokenStaking } =
        await loadFixture(deployPreLaunchStakingFixture);

      await preLaunchStaking.connect(deployer).addToken(secondTokenStaking.getAddress());

      await mintAndStake(preLaunchStaking, tokenStaking, staker);
      await mintAndStake(preLaunchStaking, secondTokenStaking, staker);

      const userStakedBalances = await preLaunchStaking.getUserStakedBalances(staker);

      const stakedTokens = userStakedBalances[0];
      const stakedBalances = userStakedBalances[1];

      
      const firstTokenStakingAddress = await tokenStaking.getAddress();
      const secondTokenStakingAddress = await secondTokenStaking.getAddress();
      assert.include(stakedTokens, firstTokenStakingAddress);
      assert.include(stakedTokens, secondTokenStakingAddress);

      const firstTokenStakingBalance = stakedBalances[0];
      const secondTokenStakingBalance = stakedBalances[1];
      assert.equal(firstTokenStakingBalance.toString(), STAKING_AMOUNT.toString());
      assert.equal(secondTokenStakingBalance.toString(), STAKING_AMOUNT.toString());
    })
  })

  describe("#getAllAcceptedTokens", function () {
    it("return get all accepted tokens", async function(){
      const [, staker]: SignerWithAddress[] = await ethers.getSigners();
      const { deployer, preLaunchStaking, tokenStaking, secondTokenStaking } =
        await loadFixture(deployPreLaunchStakingFixture);

      await preLaunchStaking.connect(deployer).addToken(secondTokenStaking);
      const allAcceptedTokens = await preLaunchStaking.getAllAcceptedTokens();
      const firstTokenStakingAddress = await tokenStaking.getAddress();
      const secondTokenStakingAddress = await secondTokenStaking.getAddress();
      assert.include(allAcceptedTokens, firstTokenStakingAddress);
      assert.include(allAcceptedTokens, secondTokenStakingAddress);

      await preLaunchStaking.connect(deployer).removeToken(tokenStaking);
      const allAcceptedTokens_2 = await preLaunchStaking.getAllAcceptedTokens();
      assert.include(allAcceptedTokens_2, secondTokenStakingAddress);
    })

  })
});
