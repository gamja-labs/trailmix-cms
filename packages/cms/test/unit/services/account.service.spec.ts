import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { faker } from '@faker-js/faker';

import * as TestUtils from '../../utils';

import { AccountService } from '@/services';
import { AccountCollection } from '@/collections';

describe('AccountService', () => {
    let service: AccountService;
    let accountCollection: jest.Mocked<AccountCollection>;

    beforeEach(async () => {
        // Mock Logger methods to prevent console output during tests
        jest.spyOn(Logger.prototype, 'log').mockImplementation();
        jest.spyOn(Logger.prototype, 'error').mockImplementation();
        jest.spyOn(Logger.prototype, 'warn').mockImplementation();
        jest.spyOn(Logger.prototype, 'debug').mockImplementation();
        jest.spyOn(Logger.prototype, 'verbose').mockImplementation();

        const mockAccountCollection = {
            findOne: jest.fn(),
            upsertOne: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AccountService,
                {
                    provide: AccountCollection,
                    useValue: mockAccountCollection,
                },
            ],
        }).compile();

        service = module.get<AccountService>(AccountService);
        accountCollection = module.get(AccountCollection);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        // Restore Logger methods after all tests
        jest.restoreAllMocks();
    });

    describe('getAccount', () => {
        it('calls findOne with correct query and returns result', async () => {
            const userId = faker.string.uuid();
            const account = TestUtils.Entities.createAccount({ user_id: userId });

            accountCollection.findOne.mockResolvedValue(account);

            const result = await service.getAccount(userId);

            expect(accountCollection.findOne).toHaveBeenCalledWith({ user_id: userId });
            expect(result).toEqual(account);
        });
    });

    describe('upsertAccount', () => {
        it('calls upsertOne with correct parameters and returns result', async () => {
            const userId = faker.string.uuid();
            const account = TestUtils.Entities.createAccount({ user_id: userId });

            accountCollection.upsertOne.mockResolvedValue(account);

            const result = await service.upsertAccount(userId);

            expect(accountCollection.upsertOne).toHaveBeenCalledWith(
                { user_id: userId },
                {
                    $set: {
                        user_id: userId,
                    },
                    $setOnInsert: {},
                },
                {
                    system: true,
                    message: 'Account upserted',
                    source: AccountService.name,
                }
            );
            expect(result).toEqual(account);
        });
    });
});
