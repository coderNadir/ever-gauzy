import { User } from '..';
import { Organization } from './organization.model';

export interface Employee {
    id?: string;
    user: User;
    userId: string;
    organization: Organization;
    orgId: string;
    valueDate?: Date;
    readonly createdAt?: Date;
    readonly updatedAt?: Date;
}