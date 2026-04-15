import { JsonRpcProvider, Wallet, keccak256, toUtf8Bytes } from "ethers";
import { getCurrentTimePH } from "@/lib/utils/date-formatting";

const POLYGON_AMOY_CHAIN_ID = 80002;

const POLYGON_AMOY_FALLBACK_RPCS = [
  "https://rpc-amoy.polygon.technology",
  "https://polygon-amoy.blockpi.network/v1/rpc/public",
  "https://polygon-amoy-bor-rpc.publicnode.com",
];

const BURN_ADDRESS = "0x000000000000000000000000000000000000dEaD";

export function getPolygonAmoyProvider(): JsonRpcProvider {
  const rpcUrl =
    process.env.POLYGON_AMOY_RPC_URL || POLYGON_AMOY_FALLBACK_RPCS[0];

  try {
    return new JsonRpcProvider(rpcUrl, {
      name: "amoy",
      chainId: POLYGON_AMOY_CHAIN_ID,
    });
  } catch {
    for (const fallbackRpc of POLYGON_AMOY_FALLBACK_RPCS) {
      if (fallbackRpc !== rpcUrl) {
        try {
          return new JsonRpcProvider(fallbackRpc, {
            name: "amoy",
            chainId: POLYGON_AMOY_CHAIN_ID,
          });
        } catch {
          // try next fallback
        }
      }
    }

    throw new Error("All RPC endpoints failed");
  }
}

export function getBlockchainWallet(): Wallet {
  const privateKey = process.env.POLYGON_AMOY_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error("POLYGON_AMOY_PRIVATE_KEY environment variable is not set");
  }

  const provider = getPolygonAmoyProvider();
  return new Wallet(privateKey, provider);
}

function createApplicationHash(
  applicationId: string,
  userId: string,
  timestamp: string
): string {
  const data = `${applicationId}-${userId}-${timestamp}`;
  return keccak256(toUtf8Bytes(data));
}

function createAwardingHash(
  awardingId: string,
  applicationId: string,
  amount: number,
  timestamp: string
): string {
  const data = `${awardingId}-${applicationId}-${amount}-${timestamp}`;
  return keccak256(toUtf8Bytes(data));
}

export async function logApplicationToBlockchain(
  applicationId: string,
  userId: string
): Promise<string | null> {
  try {
    const wallet = getBlockchainWallet();
    const timestamp = getCurrentTimePH();

    const applicationHash = createApplicationHash(
      applicationId,
      userId,
      timestamp
    );

    const provider = wallet.provider;
    if (!provider) {
      throw new Error("Wallet provider is not initialized");
    }

    const balance = await provider.getBalance(wallet.address);

    if (balance === BigInt(0)) {
      console.warn("Wallet has no MATIC balance for gas fees");
      return null;
    }

    // 21000 base + ~2176 for 32-byte calldata = ~23176; use 60000 for safety
    const tx = await wallet.sendTransaction({
      to: BURN_ADDRESS,
      data: applicationHash,
      gasLimit: 60000,
    });

    const receipt = await tx.wait();

    if (!receipt) {
      throw new Error("Transaction receipt is null");
    }

    return receipt.hash;
  } catch (error) {
    console.error("Error logging application to blockchain:", error);
    return null;
  }
}

export async function logAwardingToBlockchain(
  awardingId: string,
  applicationId: string,
  amount: number
): Promise<string | null> {
  try {
    const wallet = getBlockchainWallet();
    const timestamp = getCurrentTimePH();
    const awardingHash = createAwardingHash(
      awardingId,
      applicationId,
      amount,
      timestamp
    );

    const tx = await wallet.sendTransaction({
      to: BURN_ADDRESS,
      data: awardingHash,
      gasLimit: 60000,
    });

    const receipt = await tx.wait();
    if (!receipt) {
      throw new Error("Awarding transaction receipt is null");
    }

    return receipt.hash;
  } catch (error) {
    console.error("Error logging awarding to blockchain:", error);
    return null;
  }
}

export async function verifyTransaction(
  transactionHash: string
): Promise<boolean> {
  try {
    const provider = getPolygonAmoyProvider();
    const receipt = await provider.getTransactionReceipt(transactionHash);
    return receipt !== null && receipt.status === 1;
  } catch (error) {
    console.error("Error verifying transaction:", error);
    return false;
  }
}
