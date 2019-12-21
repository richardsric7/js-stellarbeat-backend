import {Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany} from "typeorm";
import OrganizationIdStorage from "./OrganizationIdStorage";
import NodeSnapShot from "./NodeSnapShot";

type OrganizationV2 = {
    name: string,
    dba?: string,
    url?: string,
    logo?: string,
    description?: string,
    physicalAddress?: string,
    physicalAddressAttestation?: string,
    phoneNumber?: string,
    phoneNumberAttestation?: string,
    keybase?: string,
    twitter?: string,
    github?: string,
    officialEmail?: string,
    validators: string[],
}

/**
 * Contains all versions of all organizations
 */
@Entity("organizationV2")
export default class OrganizationSnapShot {

    @PrimaryGeneratedColumn()
    // @ts-ignore
    id: number;

    @ManyToOne(type => OrganizationIdStorage, {nullable: false})
    organizationId: OrganizationIdStorage;

    //undefined if not retrieved from database.
    @OneToMany(type => NodeSnapShot, node_snap_shot => node_snap_shot.organizationSnapShot)
    validators?: NodeSnapShot[];

    @Column("jsonb")
    organizationJson:OrganizationV2;

    constructor(organizationIdStorage: OrganizationIdStorage, organization:OrganizationV2) {
        this.organizationId = organizationIdStorage;
        this.organizationJson = organization;/*{
            name: organization.name,
            dba: organization.dba,
            url: organization.url,
            logo: organization.logo,
            description: organization.description,
            physicalAddress: organization.physicalAddress,
            physicalAddressAttestation: organization.physicalAddressAttestation,
            phoneNumber: organization.phoneNumber,
            phoneNumberAttestation: organization.phoneNumberAttestation,
            keybase: organization.keybase,
            twitter: organization.twitter,
            github: organization.github,
            officialEmail: organization.officialEmail,
            validators: organization.validators
        }*/
    }
}