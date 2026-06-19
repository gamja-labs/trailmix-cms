import { Injectable, Logger } from '@nestjs/common';
import { AccountCollection } from '../collections/index.js';

@Injectable()
export class AccountService {
    private readonly logger = new Logger(AccountService.name);

    constructor(
        private accountCollection: AccountCollection,
    ) { }

    /** Get account by the Clerk `userId`. */
    async getAccount(userId: string) {
        return await this.accountCollection.findOne({ user_id: userId });
    }

    /** If the account does not exist, create it; upsert is safe for race conditions. */
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
