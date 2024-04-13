import "@openzeppelin/hardhat-upgrades"
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
require('dotenv').config();

// For verification
// https://hardhat.org/hardhat-runner/plugins/nomicfoundation-hardhat-verify
// npx hardhat verify --list-networks
// npx hardhat verify --network base <address>

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    'base': {
      url: 'https://mainnet.base.org',
      accounts: [`${process.env.PRIVATE_KEY as string}`],
      chainId: 8453,
    },
    'avalanche': {
      url: 'https://api.avax.network/ext/bc/C/rpc',
      chainId: 43114,
      accounts: [`${process.env.PRIVATE_KEY as string}`],
    },
    'mantle': {
      url: 'https://rpc.mantle.xyz',
      accounts: [`${process.env.PRIVATE_KEY as string}`],
      chainId: 5000
    },
    'mainnet': {
      url: 'https://mainnet.infura.io/v3/149e969a221349be9b2857c1cb9090ef',
      accounts: [`${process.env.PRIVATE_KEY as string}`],
      chainId: 1
    },
    'arbitrumOne': {
      url: "https://arb1.arbitrum.io/rpc",
      chainId: 42161,
      accounts: [`${process.env.PRIVATE_KEY as string}`],
    },
    'bsc': {
      url: "https://bsc-dataseed.binance.org",
      chainId: 56,
      accounts: [`${process.env.PRIVATE_KEY as string}`],
    },
    'polygon': {
      url: "https://polygon-rpc.com",
      chainId: 137,
      accounts: [`${process.env.PRIVATE_KEY as string}`],
    },
    'optimisticEthereum': {
      url: "https://mainnet.optimism.io",
      chainId: 10,
      accounts: [`${process.env.PRIVATE_KEY as string}`],
    },
    'linea_mainnet': {
      url: "https://mainnet.infura.io/v3/",
      chainId: 59144,
      accounts: [`${process.env.PRIVATE_KEY as string}`],
    },
    'blast': {
      url: "https://rpc.blast.io",
      chainId: 81457,
      accounts: [`${process.env.PRIVATE_KEY as string}`],
    },
    'mode': {
      url: "https://1rpc.io/mode",
      chainId: 34443,
      accounts: [`${process.env.PRIVATE_KEY as string}`],
    },
  },
  etherscan: {
    apiKey: {
        mainnet: process.env.MAINNET,
        optimisticEthereum: process.env.OPTIMISM,
        bsc: process.env.BSC,
        avalanche: process.env.AVALANCHE,
        arbitrumOne: process.env.ARBITRUM,
        polygon: process.env.POLYGON,
        base: process.env.BASE,
        linea_mainnet: process.env.LINEA,
        mantle: '',
    },
    customChains: [
      {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org"
        }
      },
      {
        network: "mantle",
        chainId: 5000,
        urls: {
          apiURL: "https://explorer.mantle.xyz/api",
          browserURL: "https://explorer.mantle.xyz"
        }
      },
      {
        network: "linea_mainnet",
        chainId: 59144,
        urls: {
          apiURL: "https://api.lineascan.build/api",
          browserURL: "https://lineascan.build/"
        }
      },
      {
        network: "blast",
        chainId: 81457,
        urls: {
          apiURL: "https://blastscan.io/api",
          browserURL: "https://blastscan.io"
        }
      },
      {
        network: "mode",
        chainId: 34443,
        urls: {
          apiURL: "https://explorer.mode.network/api",
          browserURL: "https://explorer.mode.network"
        }
      }
    ]
  },
  defaultNetwork: 'hardhat',
};

export default config;
