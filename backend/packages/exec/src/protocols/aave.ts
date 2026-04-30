import { ethers } from 'ethers';
import type { Hex } from '@agentvault/types';

// Aave V3 Pool interface
export const AAVE_V3_POOL_ABI = [
  'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external',
  'function withdraw(address asset, uint256 amount, address to) external returns (uint256)',
  'function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf) external',
  'function repay(address asset, uint256 amount, uint256 interestRateMode, address onBehalfOf) external returns (uint256)',
];

export const AAVE_V3_POOL_ADDRESS_SEPOLIA: Hex = '0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951'; // Aave V3 Pool on Sepolia

export function buildAaveCalldata(
  action: 'supply' | 'borrow' | 'repay' | 'withdraw',
  asset: Hex,
  amount: string,
  onBehalfOf: Hex,
): Hex {
  const iface = new ethers.Interface(AAVE_V3_POOL_ABI);
  switch (action) {
    case 'supply':
      return iface.encodeFunctionData('supply', [asset, amount, onBehalfOf, 0]) as Hex;
    case 'withdraw':
      return iface.encodeFunctionData('withdraw', [asset, amount, onBehalfOf]) as Hex;
    case 'borrow':
      return iface.encodeFunctionData('borrow', [asset, amount, 2, 0, onBehalfOf]) as Hex; // 2 = variable rate
    case 'repay':
      return iface.encodeFunctionData('repay', [asset, amount, 2, onBehalfOf]) as Hex;
    default:
      throw new Error(`Aave action ${action} not supported`);
  }
}
