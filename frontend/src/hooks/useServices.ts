import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Service } from "../api/types";

export function useServices() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<Service[]>("/services")
      .then((res) => setServices(res.data))
      .finally(() => setLoading(false));
  }, []);

  return { services, loading };
}
