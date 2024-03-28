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
  };
  async function deployPreLaunchStakingFixture(): Promise<DeployFixture> {
    const [deployer]: SignerWithAddress[] = await ethers.getSigners();

    const tokenStakingFactory: TokenStaking__factory =
      await ethers.getContractFactory("TokenStaking", deployer);

    const tokenStaking: TokenStaking = await tokenStakingFactory.deploy();
    await tokenStaking.waitForDeployment();


    const preLaunchStakingFactory: PreLaunchStaking__factory =
      await ethers.getContractFactory("PreLaunchStaking", deployer);
    const preLaunchStaking: PreLaunchStaking = await preLaunchStakingFactory.deploy(deployer.address);
    await preLaunchStaking.waitForDeployment();

    preLaunchStaking.addToken(tokenStaking.getAddress());
    return { deployer, preLaunchStaking, tokenStaking };
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

      // require(userStakes[msg.sender][_token] >= _amount, "Insufficient balance to unstake");
      await expect(
        preLaunchStaking.connect(staker).unstake(tokenStaking.getAddress(), EXCCESS_STAKING_AMOUNT)
      ).to.be.revertedWith(
        "Insufficient balance to unstake"
      );
    });

  });

});
