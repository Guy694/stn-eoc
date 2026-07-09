import { getRouteAdvice } from "@/lib/routeAdvice";

export async function POST(request) {
    try {
        const body = await request.json();
        const result = await getRouteAdvice({
            message: body.message || "",
            from: body.from,
            to: body.to
        });

        return Response.json(result, { status: result.success ? 200 : 400 });
    } catch (error) {
        console.error("Route advice error:", error);
        return Response.json({
            success: false,
            message: "ไม่สามารถประเมินเส้นทางได้ในขณะนี้"
        }, { status: 500 });
    }
}

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const result = await getRouteAdvice({
            message: searchParams.get("message") || "",
            from: searchParams.get("from"),
            to: searchParams.get("to")
        });

        return Response.json(result, { status: result.success ? 200 : 400 });
    } catch (error) {
        console.error("Route advice error:", error);
        return Response.json({
            success: false,
            message: "ไม่สามารถประเมินเส้นทางได้ในขณะนี้"
        }, { status: 500 });
    }
}
