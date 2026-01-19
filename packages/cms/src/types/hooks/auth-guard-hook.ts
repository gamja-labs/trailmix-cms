import { Account } from '@trailmix-cms/models';

/**
 * Interface for auth guard hooks that execute custom logic when an account is first created.
 */
export interface AuthGuardHook {
    /**
     * Called when a new account is created during authentication.
     * @param account The account entity that was just created
     * @returns Promise<boolean> - Return true to allow authentication, false to reject
     */
    onHook(account: Account.Entity): Promise<boolean>;
}