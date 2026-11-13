import type { DemoActor } from './types.js';

export const LOCAL_CHAIN_ID = 31_337;
export const MOCK_USD_DECIMALS = 6;
export const ANVIL_DEMO_MNEMONIC =
  'test test test test test test test test test test test junk';

/** Deterministic CREATE addresses from DeployPhase1 on a clean Anvil chain. */
export const PHASE1_CONTRACTS = {
  mockUsd: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  eligibilityRegistry: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
  bondToken: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0'
} as const;

/** Deterministic CREATE addresses from DeployPhase2 on a clean Anvil chain. */
export const PHASE2_CONTRACTS = {
  ...PHASE1_CONTRACTS,
  greenTreasury: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
  bondOffering: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9'
} as const;

/** Deterministic sixth CREATE address from DeployPhase4 on a clean Anvil chain. */
export const PHASE4_CONTRACTS = {
  ...PHASE2_CONTRACTS,
  bondServicingVault: '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707'
} as const;

export const DEMO_ACTORS = [
  {
    id: 'admin',
    displayName: 'Platform Admin',
    organization: 'GreenFlow Platform',
    role: 'ADMIN',
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    eligibleInvestor: null,
    description: 'Configures fictional eligibility and platform controls.'
  },
  {
    id: 'issuer',
    displayName: 'GreenSun Issuer',
    organization: 'GreenSun Energy Pte Ltd',
    role: 'ISSUER',
    address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    eligibleInvestor: null,
    description: 'Offers the bond and proposes use-of-proceeds requests.'
  },
  {
    id: 'verifier',
    displayName: 'Independent Verifier',
    organization: 'Independent Green Audit',
    role: 'VERIFIER',
    address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    eligibleInvestor: null,
    description: 'Independently authorizes policies and milestone evidence.'
  },
  {
    id: 'alice',
    displayName: 'Alice',
    organization: 'Fictional Investor',
    role: 'INVESTOR',
    address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    eligibleInvestor: true,
    description: 'Eligible investor allocated 6 bond units in the demo story.'
  },
  {
    id: 'bob',
    displayName: 'Bob',
    organization: 'Fictional Investor',
    role: 'INVESTOR',
    address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
    eligibleInvestor: true,
    description: 'Eligible investor allocated 4 bond units in the demo story.'
  },
  {
    id: 'charlie',
    displayName: 'Charlie',
    organization: 'Fictional Investor',
    role: 'INVESTOR',
    address: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc',
    eligibleInvestor: false,
    description: 'Ineligible investor used to demonstrate contract rejection.'
  },
  {
    id: 'vendor-a',
    displayName: 'SolarSupply',
    organization: 'SolarSupply Pte Ltd',
    role: 'VENDOR',
    address: '0x976EA74026E726554dB657fA54763abd0C3a0aa9',
    eligibleInvestor: null,
    description: 'Approved vendor for the fictional solar project.'
  },
  {
    id: 'vendor-b',
    displayName: 'UnknownVendor',
    organization: 'Unapproved vendor fixture',
    role: 'VENDOR',
    address: '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955',
    eligibleInvestor: null,
    description: 'Unapproved vendor used for a blocked-payment scenario.'
  }
] as const satisfies readonly DemoActor[];

export const DEMO_TERMS = {
  issuer: 'GreenSun Energy Pte Ltd',
  offeringName: 'GreenSun Solar Green Bond 2026',
  offeringId: 'GSGB-2026',
  symbol: 'GSGB',
  totalBondUnits: 10,
  faceValueSubunits: '100000000',
  totalProceedsSubunits: '1000000000',
  couponRateBps: 500,
  couponPerUnitSubunits: '5000000',
  servicingFundingSubunits: '1050000000',
  servicingPrincipalSubunits: '1000000000',
  servicingCouponSubunits: '50000000',
  projectId: 'PROJECT-001',
  projectName: 'Solar Panels for Community Facilities',
  projectBudgetSubunits: '800000000',
  milestones: [
    {
      id: 'M1',
      label: 'Equipment delivery',
      maxAmountSubunits: '300000000'
    },
    {
      id: 'M2',
      label: 'Installation completion',
      maxAmountSubunits: '500000000'
    }
  ]
} as const;

export const PLANNED_ROUTES = [
  { path: '/demo', label: 'Home', phase: 0 },
  { path: '/issuer/offerings', label: 'Offering', phase: 3 },
  { path: '/issuer/treasury', label: 'Treasury', phase: 3 },
  { path: '/verifier', label: 'Verification', phase: 3 },
  { path: '/investor', label: 'Investor view', phase: 3 },
  { path: '/impact', label: 'Use of proceeds', phase: 3 },
  { path: '/admin', label: 'Administration', phase: 3 }
] as const;

