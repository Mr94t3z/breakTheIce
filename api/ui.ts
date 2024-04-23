import { createSystem } from "frog/ui";

export const {
    Box,
    Columns,
    Column,
    Heading,
    HStack,
    Rows,
    Row,
    Spacer,
    Text,
    VStack,
    vars,
    Image,
    Divider,
} = createSystem({
    fonts: {
        default: [
            {
                name: "Open Sans",
                source: "google",
                weight: 400,
            },
        ],
        madimi:  [
            {
                name: "Madimi One",
                source: "google",
                weight: 400,
            },
        ]
    },
    Box: {
            alignContent: "center",
            alignItems: "center",
            grow: true,
            width: "100%",
            height: "100%",
            justifyContent: "center",
            backgroundColor: "#44444",
    }
})