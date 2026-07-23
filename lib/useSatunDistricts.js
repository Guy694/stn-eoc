"use client";

import { useEffect, useState } from "react";

export function useSatunDistricts() {
    const [districts, setDistricts] = useState([]);

    useEffect(() => {
        const controller = new AbortController();
        fetch("/stn-eoc/api/common/areas", { signal: controller.signal })
            .then((response) => response.json())
            .then((result) => setDistricts(result.success && Array.isArray(result.data) ? result.data : []))
            .catch((error) => {
                if (error.name !== "AbortError") {
                    console.error("Unable to load area master data:", error);
                    setDistricts([]);
                }
            });
        return () => controller.abort();
    }, []);

    return districts;
}
