"use client";

import {
    AirplaneTilt,
    Barbell,
    Bank,
    Bed,
    BookOpen,
    Briefcase,
    Bus,
    CalendarBlank,
    Camera,
    Car,
    Code,
    Coffee,
    Coins,
    Columns,
    ForkKnife,
    GraduationCap,
    Heartbeat,
    House,
    ImageSquare,
    Lightbulb,
    MapPin,
    Mountains,
    MusicNotes,
    PaintBrush,
    ShoppingBag,
    Star,
    Train,
    Tree,
    Users,
    Waves,
    Wine,
    type Icon,
} from "@phosphor-icons/react";

/** Curated set the model may pick from. Keep names short and domain-neutral. */
const ICONS = {
    landmark: Bank,
    museum: Columns,
    food: ForkKnife,
    coffee: Coffee,
    drink: Wine,
    shopping: ShoppingBag,
    park: Tree,
    beach: Waves,
    hiking: Mountains,
    hotel: Bed,
    bus: Bus,
    flight: AirplaneTilt,
    train: Train,
    car: Car,
    music: MusicNotes,
    book: BookOpen,
    study: GraduationCap,
    code: Code,
    work: Briefcase,
    fitness: Barbell,
    health: Heartbeat,
    art: PaintBrush,
    photo: Camera,
    event: CalendarBlank,
    idea: Lightbulb,
    star: Star,
    home: House,
    money: Coins,
    people: Users,
    pin: MapPin,
} as const satisfies Record<string, Icon>;

export type RichIconName = keyof typeof ICONS;
export const RICH_ICON_NAMES = Object.keys(ICONS) as [RichIconName, ...RichIconName[]];

export function isRichIconName(value: unknown): value is RichIconName {
    return typeof value === "string" && Object.hasOwn(ICONS, value);
}

export function RichIcon({
    name,
    size = 18,
    weight = "duotone",
}: {
    name?: RichIconName;
    size?: number;
    weight?: "regular" | "bold" | "duotone" | "fill";
}) {
    const Glyph = name ? ICONS[name] : ImageSquare;
    return <Glyph size={size} weight={weight} aria-hidden />;
}
