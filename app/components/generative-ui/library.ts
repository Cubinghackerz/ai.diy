"use client";

import { createLibrary, defineComponent, type PromptOptions } from "@openuidev/react-lang";
import { openuiChatLibrary, openuiChatPromptOptions } from "@openuidev/react-ui";
import { z } from "zod/v4";
import { RICH_COMPONENTS } from "./rich-components";

const RICH_NAMES = RICH_COMPONENTS.map((component) => component.name);

/**
 * The stock chat `Card` only accepts the stock children. Re-declare it with
 * the same renderer and description, widening `children` to include the Rich
 * components so the model may use them at the top level.
 */
const baseCard = openuiChatLibrary.components["Card"];
const baseShape = baseCard.props.shape as {
    children: z.ZodArray<z.ZodUnion<z.ZodType[]>>;
    sources: z.ZodType;
};
const baseChildren = baseShape.children.element.options;

const RichCard = defineComponent({
    name: "Card",
    props: z.object({
        children: z.array(
            z.union([...baseChildren, ...RICH_COMPONENTS.map((component) => component.ref)] as [
                z.ZodType,
                z.ZodType,
                ...z.ZodType[],
            ]),
        ),
        sources: baseShape.sources as z.ZodOptional<z.ZodType<unknown>>,
    }),
    description: baseCard.description,
    component: baseCard.component,
});

export const richLibrary = createLibrary({
    root: "Card",
    componentGroups: [
        ...(openuiChatLibrary.componentGroups ?? []),
        {
            name: "Rich",
            components: RICH_NAMES,
            notes: [
                "- Define each RichItem once (id, title, label, description, icon, category, lat, lng, query, link) and reference it from RichGallery, RichTimeline, RichMap and RichSuggestions so they stay in sync.",
                "- A RichMap and RichTimeline that share the same items highlight the same entry on click.",
            ],
        },
    ],
    components: [
        ...Object.values({ ...openuiChatLibrary.components, Card: RichCard }),
        ...RICH_COMPONENTS,
    ],
});

export const RICH_EXAMPLE_PROGRAM = `root = Card([head, intro, gallery, timeline, map, more, FollowUpBlock(["Make it cheaper", "Add a rainy-day option"])])
head = RichHeading("A day in Rome", "Walkable highlights, about 8 hours")
intro = TextContent("Start early to beat the crowds, then work outward from the centre.")
a = RichItem("a", "Colosseum", "09:00", "Book timed entry ahead.", "landmark", "Landmark", 41.8902, 12.4922, "Colosseum")
b = RichItem("b", "Roman Forum", "11:30", "Ancient civic centre next door.", "museum", "Landmark", 41.8925, 12.4853, "Roman Forum")
c = RichItem("c", "Trastevere lunch", "13:30", "Cobbled lanes and trattorias.", "food", "Food", 41.8896, 12.4698)
d = RichItem("d", "Trevi Fountain", "17:00", "Go at dusk.", "landmark", "Landmark", 41.9009, 12.4833, "Trevi Fountain")
gallery = RichGallery([a, b, d], "Photos from Wikipedia")
timeline = RichTimeline([a, b, c, d], "The day")
map = RichMap([a, b, c, d], "Route", true)
e = RichItem("e", "Borghese Gallery", null, "Baroque masterpieces; reserve a slot.", "art")
more = RichSuggestions([e], "You might also like")`;

const RICH_EXAMPLE = `Example — Plan with photos, timeline, map and follow-ups (use for trips, projects, study plans, tours, itineraries; pass null to skip an optional argument):

${RICH_EXAMPLE_PROGRAM}`;

const RICH_RULES = [
    "Use RichGallery/RichTimeline/RichMap/RichSuggestions/RichFigure when the answer is a plan, route, schedule, list of places, comparison of options or collection of things with pictures or locations. For plain answers use TextContent, Table or other basics.",
    "Choose each RichItem icon from its fixed list of names; never put emojis in any prop.",
    "For a chart, plot, or generated image: call run_python first and save it with matplotlib savefig (PNG), then show it with RichFigure using the exact filename. Never describe a chart you did not generate, and never put image data or URLs in props.",
    "Never invent lat/lng. Provide them only when certain, or set query to the exact English Wikipedia article title so coordinates and photos can be looked up. Skip RichMap when nothing has a place.",
    "RichGallery shows at most 6 photos and only for items that have a query. Do not put URLs in props except link, which must be an absolute https URL.",
    "RichSuggestions buttons send 'Add <title>' as the next user message (and are disabled while a reply is running); offer 2-4 ideas that are not already in the plan.",
];

export const richPromptOptions: PromptOptions = {
    ...openuiChatPromptOptions,
    examples: [...(openuiChatPromptOptions.examples ?? []), RICH_EXAMPLE],
    additionalRules: [...(openuiChatPromptOptions.additionalRules ?? []), ...RICH_RULES],
};
