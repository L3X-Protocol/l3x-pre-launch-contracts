import { ethers, upgrades } from 'hardhat';
import dotenv from 'dotenv';

dotenv.config();

// example usage
// npx hardhat run --network avalanche-mainnet scripts/upgrade.ts
// npx hardhat verify --network mainnet <new_implementation_address>

// must fill in before running
const PROXY_ADDRESS = '';

async function main() {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = deployer.address;

  console.log('Upgrading contract with the account:', deployerAddress);

  // Retrieve the existing proxy contract
  const PreLaunchStaking: any = await ethers.getContractFactory('PreLaunchStaking');
  console.log('Preparing to upgrade PreLaunchStaking at proxy address:', PROXY_ADDRESS);

  // Upgrade the existing proxy to a new implementation
  const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, PreLaunchStaking);
  await upgraded.waitForDeployment();

  const newImplementationAddress = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
  console.log('PreLaunchStaking has been upgraded.');
  console.log('New implementation address:', newImplementationAddress);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });