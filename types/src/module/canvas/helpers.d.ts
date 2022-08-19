import { MeasuredTemplatePF2e } from "./measured-template";
import { TokenPF2e } from "./token";
/**
 * Measure the minimum distance between two rectangles
 * @param r0      The origin rectangle
 * @param r1      The destination rectangle
 * @param [reach] If this is a reach measurement, the origin actor's reach
 */
declare function measureDistanceRect(r0: NormalizedRectangle, r1: NormalizedRectangle, { reach }?: {
    reach?: number | null;
}): number;
/** Highlight grid according to Pathfinder 2e effect-area shapes */
declare function highlightGrid({ type, object, colors, data, collisionType }: HighlightGridParams): void;
interface HighlightGridParams {
    type: "burst" | "cone" | "emanation";
    object: MeasuredTemplatePF2e | TokenPF2e;
    /** Border and fill colors in hexadecimal */
    colors: {
        border: number;
        fill: number;
    };
    /** Shape data for the effect area: satisfied by MeasuredTemplateData */
    data: Readonly<{
        x: number;
        y: number;
        distance: number;
        angle?: number;
        direction?: number;
    }>;
    collisionType?: WallRestrictionType;
}
export { highlightGrid, measureDistanceRect };
