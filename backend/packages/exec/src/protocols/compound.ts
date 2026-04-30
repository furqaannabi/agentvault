import { ethers } from 'ethers';
import type { Hex } from '@agentvault/types';

// Compound V3 Comet ABI
export const COMPOUND_V3_COMET_ABI = [
  'function supply(address asset, uint256 amount) external',
  'function withdraw(address asset, uint256 amount) external',
];

export const COMPOUND_V3_COMET_SEPOLIA: Hex = '0xc3d688B66703497DAA19211EEdff47f25384cdc3'; // cUSDCv3 Sepolia

export function buildCompoundCalldata(
  action: 'supply' | 'borrow' | 'repay' | 'withdraw',
  asset: Hex,
  amount: string,
): Hex {
  const iface = new ethers.Interface(COMPOUND_V3_COMET_ABI);
  switch (action) {
    case 'supply':
      return iface.encodeFunctionData('supply', [asset, amount]) as Hex;
    case 'withdraw':
      return iface.encodeFunctionData('withdraw', [asset, amount]) as Hex;
    default:
      throw new Error(`Compound action ${action} not supported (yet)`);
  }
}
