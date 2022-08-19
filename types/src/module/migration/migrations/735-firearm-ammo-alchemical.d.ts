import { ItemSourcePF2e } from "@item/data";
import { MigrationBase } from "../base";
/** Add the "alchemical" trait to all firearm ammunition */
export declare class Migration735FirearmAmmoAlchemical extends MigrationBase {
    #private;
    static override: any;
    version: number;
    override: any;
    updateItem(source: ItemSourcePF2e): Promise<void>;
}
