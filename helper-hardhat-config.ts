import { BigNumberish } from "ethers";
import { ethers } from "hardhat";
type NetworkConfigItem = {
  name: string;
};

type NetworkConfigMap = {
  [chainId: string]: NetworkConfigItem;
};

export const networkConfig: NetworkConfigMap = {
  default: {
    name: "hardhat",
  },
  31337: {
    name: "localhost",
  },
  1: {
    name: "mainnet",
  },
  11155111: {
    name: "sepolia",
  },
  137: {
    name: "polygon",
  },
};

export const ADDRESS_ZERO: string = ethers.ZeroAddress;

export const REWARD_AMOUNT: BigNumberish = ethers.parseUnits("1000");
export const ONE_TOKEN = ethers.parseUnits("1");
export const STAKING_AMOUNT: BigNumberish = ethers.parseUnits("100"); // 100 tokens

export const developmentChains: string[] = ["hardhat", "localhost"];
export const VERIFICATION_BLOCK_CONFIRMATIONS = 6;
