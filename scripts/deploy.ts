import { ethers, upgrades } from 'hardhat';
import dotenv from 'dotenv';

dotenv.config();

// example deploy
// npx hardhat run --network avalanche-mainnet scripts/deploy.ts
// npx hardhat verify --network mainnet <address>

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

  // deployments

  // ETH MAINNET:
  // PreLaunch Proxy deployed to: 0xC5928F4e742873356e8126bda92B02e7C86F043b
  // PreLaunch implementation address at: 0x1F803A31d4d1024Da0a9327850c8d9b3e7143F6A

  // Arbitrum
  // PreLaunch Proxy deployed to: 0x0809F0Ee8e72b2e2069e0f618cBbCB2399D452c7
  // PreLaunch implementation address at: 0xd6cB127C9974507054f38d806aaEF66651d378ca

  // Linea
  // PreLaunch Proxy deployed to: 0x0809F0Ee8e72b2e2069e0f618cBbCB2399D452c7
  // PreLaunch implementation address at: 0xBe4269c4AC77cF2Ea71148340280B87Df988fC30

  // Mode
  // PreLaunch Proxy deployed to: 0x0809F0Ee8e72b2e2069e0f618cBbCB2399D452c7
  // PreLaunch implementation address at: 0xBe4269c4AC77cF2Ea71148340280B87Df988fC30

  // Blast
  // PreLaunch Proxy deployed to: 0x0809F0Ee8e72b2e2069e0f618cBbCB2399D452c7
  // PreLaunch implementation address at: 0xC5928F4e742873356e8126bda92B02e7C86F043b
