import {Account as Web3Account, clusterApiUrl, Connection, Keypair, LAMPORTS_PER_SOL, PublicKey} from "@solana/web3.js";

// @ts-ignore
import token from "../token_creator.json"
import {
    Account,
    createMint,
    getAccount,
    getMint,
    getOrCreateAssociatedTokenAccount,
    mintTo, TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

import {
    TOKEN_SWAP_PROGRAM_ID,
    TokenSwap,
    CurveType,
} from '@solana/spl-token-swap';

import fs from "fs"
import * as console from "console";

const CURRENT_TOKEN_SWAP_PROGRAM_ID =
    // new PublicKey('HUhawEZRhp1yHmSYTXKAPjMiyV8QFWHz9NL44X1XP6rk');
    TOKEN_SWAP_PROGRAM_ID;

const connection: Connection = new Connection(
    clusterApiUrl('devnet'),
// "http://localhost:8899",
    'confirmed'
);

const owner: Keypair = Keypair.fromSecretKey(
    Uint8Array.from(
        token
    )
);

const balanceOperations = async () => {
    const balance: number = await connection.getBalance(owner.publicKey)
    console.log(balance);
    if (balance < 1) {
        const tx = await connection.requestAirdrop(
            owner.publicKey,
            LAMPORTS_PER_SOL,
        );
        await connection.confirmTransaction(tx);
    }
    console.log(`payer balance: ${balance}`);

}

const main = async () => {
 await balanceOperations();
    let mintA: PublicKey;
    console.log("creating or getting tokenAMint")
    if (fs.existsSync(`tokenAMint`)) {
        const tokenAddress = fs.readFileSync(`tokenAMint`)
            .toString('utf-8');
        mintA = new PublicKey(tokenAddress);
    } else {
        mintA = await createMint(
            connection,
            owner,
            owner.publicKey,
            null,
            9 // We are using 9 to match the CLI decimal default exactly
        );
        fs.writeFileSync(`tokenAMint`, mintA.toBase58(), {encoding: "utf-8"})
    }

    let mintB: PublicKey;
    console.log("creating or getting tokenBMint");
    if (fs.existsSync(`tokenBMint`)) {
        const tokenAddress = fs.readFileSync(`tokenBMint`)
            .toString('utf-8');
        mintB = new PublicKey(tokenAddress);
    } else {
        mintB = await createMint(
            connection,
            owner,
            owner.publicKey,
            null,
            9 // We are using 9 to match the CLI decimal default exactly
        );
        fs.writeFileSync(`tokenBMint`, mintB.toBase58(), {encoding: "utf-8"})
    }

    console.log("generation swap account")
    const swapKP: Keypair = Keypair.generate();

    console.log("creating swap authority pda")
    const [swapAuthority, nonce]: [PublicKey, number] = await PublicKey.findProgramAddress(
        [swapKP.publicKey.toBuffer()],
        CURRENT_TOKEN_SWAP_PROGRAM_ID,
    );

    console.log("generating tokenA Data Acc for swap program")
    const tokenAAccount: Account = await getOrCreateAssociatedTokenAccount(connection, owner, mintA, swapAuthority, true)
    console.log("generating tokenB Data Acc for swap program")
    const tokenBAccount: Account = await getOrCreateAssociatedTokenAccount(connection, owner, mintB, swapAuthority, true)
    console.log("create pool token mint")
    const poolTokenMint: PublicKey = await createMint(
        connection,
        owner,
        swapAuthority,
        null,
        9 // We are using 9 to match the CLI decimal default exactly
    );

    await mintTo(connection, owner, mintA, tokenAAccount.address, owner, 200)
    await mintTo(connection, owner, mintB, tokenBAccount.address, owner, 400)

    console.log("create pool token data account")
    const tokenPoolAccount: Account = await getOrCreateAssociatedTokenAccount(connection,
        owner,
        poolTokenMint,
        owner.publicKey,
        true)
    console.log("create fee token data account")
    const tokenFeeAccount: Account = await getOrCreateAssociatedTokenAccount(connection,
        owner,
        poolTokenMint,
        owner.publicKey,
    )

    console.log("create token swap")
    const tokenSwap: TokenSwap = await TokenSwap.createTokenSwap(connection,
        new Web3Account(owner.secretKey),
        new Web3Account(swapKP.secretKey),
        swapAuthority,
        tokenAAccount.address,
        tokenBAccount.address,
        poolTokenMint,
        mintA,
        mintB,
        tokenFeeAccount.address,
        tokenPoolAccount.address,
        CURRENT_TOKEN_SWAP_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        nonce,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        CurveType.ConstantPrice,
    )
}

main();