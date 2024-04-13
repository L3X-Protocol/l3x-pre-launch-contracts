import { ethers, upgrades } from 'hardhat';
import dotenv from 'dotenv';

dotenv.config();

// example deploy
// npx hardhat run --network avalanche-mainnet scripts/deploy.ts

const PUBLIC_KEY = process.env.PUBLIC_KEY || '';

async function main() {
  const [deployer]: any = await ethers.getSigners();
  const deployerAddress = deployer.address;

  console.log('Deploying contracts with the account:', deployerAddress);

  // Deploy SendReceive as a proxy
  const PreLaunch: any = await ethers.getContractFactory('PreLaunchStaking');
  const PreLaunchProxy = await upgrades.deployProxy(PreLaunch, [process.env.PUBLIC_KEY], { initializer: 'initialize' });
  await PreLaunchProxy.waitForDeployment();
  const proxyAddress = await PreLaunchProxy.getAddress();
  console.log('PreLaunch Proxy deployed to:', proxyAddress);
  const impAddr = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log('PreLaunch implementation address at:', impAddr);
  console.log('Deployment and function calls completed!');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
