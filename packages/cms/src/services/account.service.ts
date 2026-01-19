import { Injectable, Logger } from '@nestjs/common';
import { AccountCollection } from '../collections';

@Injectable()
export class AccountService {
    private readonly logger = new Logger(AccountService.name);

    constructor(
        private accountCollection: AccountCollection,
    ) { }

    /**
     * Get account by userId
     * 
     * @param userId 
     * @returns 
     */
    async getAccount(userId: string) {
        return await this.accountCollection.findOne({ user_id: userId });
    }

    /**
     * If account does not exist, create it, upsert is safe for race conditions
     * 
     * @param userId 
     * @returns 
     */
    async upsertAccount(userId: string) {
        const account = await this.accountCollection.upsertOne({ user_id: userId }, {
            $set: {
                user_id: userId,
            },
            $setOnInsert: {
            },
        }, {
            system: true,
            message: 'Account upserted',
            source: AccountService.name,
        });
        return account;
    }
}