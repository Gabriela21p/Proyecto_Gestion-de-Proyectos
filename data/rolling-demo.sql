--
-- PostgreSQL database dump
--

-- Dumped from database version 16.4 (Debian 16.4-1.pgdg110+2)
-- Dumped by pg_dump version 16.4 (Debian 16.4-1.pgdg110+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: tiger; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA tiger;


--
-- Name: tiger_data; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA tiger_data;


--
-- Name: topology; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA topology;


--
-- Name: SCHEMA topology; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA topology IS 'PostGIS Topology schema';


--
-- Name: fuzzystrmatch; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS fuzzystrmatch WITH SCHEMA public;


--
-- Name: EXTENSION fuzzystrmatch; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION fuzzystrmatch IS 'determine similarities and distance between strings';


--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: postgis; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;


--
-- Name: EXTENSION postgis; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION postgis IS 'PostGIS geometry and geography spatial types and functions';


--
-- Name: postgis_tiger_geocoder; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis_tiger_geocoder WITH SCHEMA tiger;


--
-- Name: EXTENSION postgis_tiger_geocoder; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION postgis_tiger_geocoder IS 'PostGIS tiger geocoder and reverse geocoder';


--
-- Name: postgis_topology; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis_topology WITH SCHEMA topology;


--
-- Name: EXTENSION postgis_topology; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION postgis_topology IS 'PostGIS topology spatial types and functions';


--
-- Name: unaccent; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;


--
-- Name: EXTENSION unaccent; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION unaccent IS 'text search dictionary that removes accents';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    icon text
);


--
-- Name: address_resolutions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.address_resolutions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    address_key text NOT NULL,
    query_address text NOT NULL,
    standard_address text NOT NULL,
    department text NOT NULL,
    department_key text NOT NULL,
    municipality text NOT NULL,
    municipality_key text NOT NULL,
    divipola character varying(5) NOT NULL,
    postal_code character varying(12) NOT NULL,
    expanded_postal_code character varying(24),
    lat double precision,
    lng double precision,
    source text NOT NULL,
    confidence numeric(4,3) DEFAULT 1.0 NOT NULL,
    verification_count integer DEFAULT 1 NOT NULL,
    raw_response jsonb,
    first_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    last_verified_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid,
    title text NOT NULL,
    description text,
    starts_on date NOT NULL,
    ends_on date NOT NULL,
    time_label text,
    cost_label text,
    status text DEFAULT 'approved'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: favorites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.favorites (
    user_id uuid NOT NULL,
    site_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: neighborhoods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.neighborhoods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    locality text NOT NULL,
    city text NOT NULL,
    country text DEFAULT 'Colombia'::text NOT NULL
);


--
-- Name: postal_municipalities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.postal_municipalities (
    divipola character varying(5) NOT NULL,
    department text NOT NULL,
    department_key text NOT NULL,
    municipality text NOT NULL,
    municipality_key text NOT NULL,
    source text DEFAULT 'client'::text NOT NULL,
    last_verified_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid,
    user_id uuid,
    reason text NOT NULL,
    detail text,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid,
    user_id uuid,
    rating integer NOT NULL,
    title text,
    body text NOT NULL,
    visited_at date,
    verified boolean DEFAULT false NOT NULL,
    weight numeric(4,2) DEFAULT 1 NOT NULL,
    status text DEFAULT 'published'::text NOT NULL,
    helpful_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: site_activities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_activities (
    site_id uuid NOT NULL,
    activity_id uuid NOT NULL
);


--
-- Name: site_suggestions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_suggestions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    category text,
    address text,
    locality text,
    city text DEFAULT 'Bogota'::text,
    department text,
    divipola character varying(5),
    postal_code character varying(12),
    description text NOT NULL,
    contact text,
    user_id uuid,
    suggested_by text,
    lat double precision,
    lng double precision,
    status text DEFAULT 'pending'::text NOT NULL,
    duplicate_site_id uuid,
    approved_site_id uuid,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    rejection_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    neighborhood_id uuid,
    name text NOT NULL,
    slug text,
    category text DEFAULT 'Sitio local'::text NOT NULL,
    address text,
    description text,
    price_range text,
    phone text,
    website text,
    image_url text,
    source text DEFAULT 'community'::text NOT NULL,
    status text DEFAULT 'approved'::text NOT NULL,
    featured boolean DEFAULT false NOT NULL,
    rating_average numeric(3,2) DEFAULT 0 NOT NULL,
    review_count integer DEFAULT 0 NOT NULL,
    verified_review_count integer DEFAULT 0 NOT NULL,
    active_event_count integer DEFAULT 0 NOT NULL,
    trust_score numeric(6,2) DEFAULT 0 NOT NULL,
    location public.geography(Point,4326) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    username text NOT NULL,
    email text,
    password_hash text,
    auth_provider text DEFAULT 'local'::text NOT NULL,
    email_verified boolean DEFAULT false NOT NULL,
    identity_level text DEFAULT 'guest'::text NOT NULL,
    role text DEFAULT 'neighbor'::text NOT NULL,
    reputation integer DEFAULT 0 NOT NULL,
    review_weight numeric(4,2) DEFAULT 1 NOT NULL,
    avatar_url text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Data for Name: activities; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.activities (id, name, icon) FROM stdin;
6a8647f8-e52d-407b-bcc2-11db366f1afc	Cafe	coffee
a7634b41-ceae-4f1b-975c-72ad8637cc6a	Restaurante	utensils
74b22c41-38ef-40db-9e76-154e76981b6c	Cultura	music
21c67f6a-bc5f-4d35-bf39-33a2ae9ec90e	Trabajo remoto	laptop
cd5a5c2b-66d5-4030-8361-b03938a6c880	Sostenible	leaf
1b80cdcf-b8bc-4e85-89b5-dfb6b5869565	Eventos	calendar
616f48f6-d8ab-453f-a629-1cac8a7eaedc	Familia	users
fbe0e9a6-dd97-4c74-b131-19f992d192b2	Noche	moon
\.


--
-- Data for Name: events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.events (id, site_id, title, description, starts_on, ends_on, time_label, cost_label, status, created_at) FROM stdin;
\.


--
-- Data for Name: neighborhoods; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.neighborhoods (id, name, locality, city, country) FROM stdin;
35efba1c-b6fa-4dfb-9365-8ba27348f94d	Chapinero Central	Chapinero	Bogota	Colombia
8a62b733-393e-481b-b798-8015f79382db	Laureles	Laureles	Medellin	Colombia
b20753df-fc59-4c67-af9a-b001f9120b7d	Getsemani	Getsemani	Cartagena	Colombia
d6218ff0-3e00-4342-a313-85667cec3098	Usaquen	Usaquen	Bogota	Colombia
d8845a95-ec2a-4491-99a8-da2ab223b8f3	La Soledad	Teusaquillo	Bogota	Colombia
74bd6884-7689-426c-b451-3225cd798419	Jardin Botanico	Engativa	Bogota	Colombia
a1978a34-7481-4bf5-8a6e-d7ac2f64b354	Centro Historico	La Candelaria	Bogota	Colombia
\.


--
-- Data for Name: site_activities; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.site_activities (site_id, activity_id) FROM stdin;
e479a69b-ec57-49d5-8e7e-6b45d15d95ae	6a8647f8-e52d-407b-bcc2-11db366f1afc
e479a69b-ec57-49d5-8e7e-6b45d15d95ae	74b22c41-38ef-40db-9e76-154e76981b6c
e479a69b-ec57-49d5-8e7e-6b45d15d95ae	1b80cdcf-b8bc-4e85-89b5-dfb6b5869565
259d5ef0-2fde-4f56-9495-4e95568af4d7	6a8647f8-e52d-407b-bcc2-11db366f1afc
259d5ef0-2fde-4f56-9495-4e95568af4d7	21c67f6a-bc5f-4d35-bf39-33a2ae9ec90e
259d5ef0-2fde-4f56-9495-4e95568af4d7	cd5a5c2b-66d5-4030-8361-b03938a6c880
4f0e7322-b9bc-4620-99ed-276c8ec7f4ee	616f48f6-d8ab-453f-a629-1cac8a7eaedc
4f0e7322-b9bc-4620-99ed-276c8ec7f4ee	cd5a5c2b-66d5-4030-8361-b03938a6c880
4f0e7322-b9bc-4620-99ed-276c8ec7f4ee	1b80cdcf-b8bc-4e85-89b5-dfb6b5869565
2390a678-16bb-4e94-8273-19ac3168b680	74b22c41-38ef-40db-9e76-154e76981b6c
2390a678-16bb-4e94-8273-19ac3168b680	21c67f6a-bc5f-4d35-bf39-33a2ae9ec90e
2390a678-16bb-4e94-8273-19ac3168b680	616f48f6-d8ab-453f-a629-1cac8a7eaedc
903102f7-7db8-49e4-b36e-f536a4e3ba2f	cd5a5c2b-66d5-4030-8361-b03938a6c880
903102f7-7db8-49e4-b36e-f536a4e3ba2f	616f48f6-d8ab-453f-a629-1cac8a7eaedc
903102f7-7db8-49e4-b36e-f536a4e3ba2f	1b80cdcf-b8bc-4e85-89b5-dfb6b5869565
77406310-cb7b-4f25-8c88-1f59106ba657	74b22c41-38ef-40db-9e76-154e76981b6c
77406310-cb7b-4f25-8c88-1f59106ba657	616f48f6-d8ab-453f-a629-1cac8a7eaedc
9a3155f3-c473-44e4-b0c6-5c5b946db69a	74b22c41-38ef-40db-9e76-154e76981b6c
9a3155f3-c473-44e4-b0c6-5c5b946db69a	6a8647f8-e52d-407b-bcc2-11db366f1afc
9a3155f3-c473-44e4-b0c6-5c5b946db69a	1b80cdcf-b8bc-4e85-89b5-dfb6b5869565
\.


--
-- Data for Name: sites; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sites (id, neighborhood_id, name, slug, category, address, description, price_range, phone, website, image_url, source, status, featured, rating_average, review_count, verified_review_count, active_event_count, trust_score, location, created_at, updated_at) FROM stdin;
4f0e7322-b9bc-4620-99ed-276c8ec7f4ee	d6218ff0-3e00-4342-a313-85667cec3098	Mercado de las Pulgas de Usaquen	google-demo-mercado-de-las-pulgas-de-usaquen	Mercado local	Carrera 6A entre calles 119 y 120A	Mercado tradicional de artesanias, antiguedades, sabores y emprendimientos locales.	\N	\N	https://www.google.com/maps/search/?api=1&query=Mercado%20de%20las%20Pulgas%20de%20Usaquen%2C%20Carrera%206A%20entre%20calles%20119%20y%20120A%2C%20Bogota	\N	google_places_demo	approved	f	0.00	0	0	0	0.00	0101000020E610000052D50451F78152C00E15E3FC4DC81240	2026-09-17 01:53:21.839374+00	2026-09-24 00:49:58.906503+00
2390a678-16bb-4e94-8273-19ac3168b680	d8845a95-ec2a-4491-99a8-da2ab223b8f3	Biblioteca Publica Virgilio Barco	google-demo-biblioteca-publica-virgilio-barco	Biblioteca	Avenida Carrera 60 #57-60	Biblioteca publica rodeada de jardines y recorridos de agua, ideal para leer, estudiar y caminar.	\N	\N	https://www.google.com/maps/search/?api=1&query=Biblioteca%20Publica%20Virgilio%20Barco%2C%20Avenida%20Carrera%2060%20%2357-60%2C%20Bogota	\N	google_places_demo	approved	f	0.00	0	0	0	0.00	0101000020E6100000F9BD4D7FF68552C0185B087250A21240	2026-09-17 01:53:21.861332+00	2026-09-24 00:49:58.926699+00
903102f7-7db8-49e4-b36e-f536a4e3ba2f	74bd6884-7689-426c-b451-3225cd798419	Jardin Botanico de Bogota	google-demo-jardin-botanico-de-bogota	Jardin botanico	Avenida Calle 63 #68-95	Colecciones vivas de la biodiversidad colombiana, senderos y experiencias ambientales para todas las edades.	\N	\N	https://www.google.com/maps/search/?api=1&query=Jardin%20Botanico%20de%20Bogota%2C%20Avenida%20Calle%2063%20%2368-95%2C%20Bogota	\N	google_places_demo	approved	f	0.00	0	0	0	0.00	0101000020E6100000AA0EB9196E8652C022A64412BDAC1240	2026-09-17 01:53:21.877109+00	2026-09-24 00:49:58.946609+00
77406310-cb7b-4f25-8c88-1f59106ba657	a1978a34-7481-4bf5-8a6e-d7ac2f64b354	Museo del Oro	google-demo-museo-del-oro	Museo	Carrera 6 #15-88	Museo dedicado al patrimonio arqueologico y a las historias de las sociedades prehispanicas de Colombia.	\N	\N	https://www.google.com/maps/search/?api=1&query=Museo%20del%20Oro%2C%20Carrera%206%20%2315-88%2C%20Bogota	\N	google_places_demo	approved	f	0.00	0	0	0	0.00	0101000020E61000001B2AC6F99B8452C02AC6F99B50681240	2026-09-17 01:53:21.893616+00	2026-09-24 00:49:58.966493+00
9a3155f3-c473-44e4-b0c6-5c5b946db69a	a1978a34-7481-4bf5-8a6e-d7ac2f64b354	Centro Cultural Gabriel Garcia Marquez	google-demo-centro-cultural-gabriel-garcia-marquez	Centro cultural	Calle 11 #5-60	Arquitectura, libreria, exposiciones y encuentros culturales en el corazon del centro historico.	\N	\N	https://www.google.com/maps/search/?api=1&query=Centro%20Cultural%20Gabriel%20Garcia%20Marquez%2C%20Calle%2011%20%235-60%2C%20Bogota	\N	google_places_demo	approved	f	0.00	0	0	0	0.00	0101000020E6100000F46C567DAE8452C0508D976E12631240	2026-09-17 01:53:21.905268+00	2026-09-24 00:49:58.982699+00
e479a69b-ec57-49d5-8e7e-6b45d15d95ae	35efba1c-b6fa-4dfb-9365-8ba27348f94d	Wilborada 1047	google-demo-wilborada-1047	Libreria y cafe	Calle 71 #10-47 Int. 4	Casa libreria de Quinta Camacho con cafe, salas de lectura y una agenda cultural abierta.	\N	\N	https://www.google.com/maps/search/?api=1&query=Wilborada%201047%2C%20Calle%2071%20%2310-47%20Int.%204%2C%20Bogota	\N	google_places_demo	approved	f	0.00	0	0	0	0.00	0101000020E610000059A31EA2D18352C022AB5B3D279D1240	2026-09-17 01:53:21.797841+00	2026-09-24 00:49:58.818991+00
259d5ef0-2fde-4f56-9495-4e95568af4d7	35efba1c-b6fa-4dfb-9365-8ba27348f94d	Cafe Cultor Quinta Camacho	google-demo-cafe-cultor-quinta-camacho	Cafe de especialidad	Calle 70A #9-44	Cafe colombiano de especialidad en una casa de barrio pensada para conversar y conocer el origen del grano.	\N	\N	https://www.google.com/maps/search/?api=1&query=Cafe%20Cultor%20Quinta%20Camacho%2C%20Calle%2070A%20%239-44%2C%20Bogota	\N	google_places_demo	approved	f	0.00	0	0	0	0.00	0101000020E6100000C8EF6DFAB38352C03F3A75E5B39C1240	2026-09-17 01:53:21.823139+00	2026-09-24 00:49:58.886733+00
\.


--
-- Data for Name: spatial_ref_sys; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.spatial_ref_sys (srid, auth_name, auth_srid, srtext, proj4text) FROM stdin;
\.


--
-- Data for Name: geocode_settings; Type: TABLE DATA; Schema: tiger; Owner: -
--

COPY tiger.geocode_settings (name, setting, unit, category, short_desc) FROM stdin;
\.


--
-- Data for Name: pagc_gaz; Type: TABLE DATA; Schema: tiger; Owner: -
--

COPY tiger.pagc_gaz (id, seq, word, stdword, token, is_custom) FROM stdin;
\.


--
-- Data for Name: pagc_lex; Type: TABLE DATA; Schema: tiger; Owner: -
--

COPY tiger.pagc_lex (id, seq, word, stdword, token, is_custom) FROM stdin;
\.


--
-- Data for Name: pagc_rules; Type: TABLE DATA; Schema: tiger; Owner: -
--

COPY tiger.pagc_rules (id, rule, is_custom) FROM stdin;
\.


--
-- Data for Name: topology; Type: TABLE DATA; Schema: topology; Owner: -
--

COPY topology.topology (id, name, srid, "precision", hasz) FROM stdin;
\.


--
-- Data for Name: layer; Type: TABLE DATA; Schema: topology; Owner: -
--

COPY topology.layer (topology_id, layer_id, schema_name, table_name, feature_column, feature_type, level, child_id) FROM stdin;
\.


--
-- Name: topology_id_seq; Type: SEQUENCE SET; Schema: topology; Owner: -
--

SELECT pg_catalog.setval('topology.topology_id_seq', 1, false);


--
-- Name: activities activities_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_name_key UNIQUE (name);


--
-- Name: activities activities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_pkey PRIMARY KEY (id);


--
-- Name: address_resolutions address_resolutions_address_key_divipola_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.address_resolutions
    ADD CONSTRAINT address_resolutions_address_key_divipola_key UNIQUE (address_key, divipola);


--
-- Name: address_resolutions address_resolutions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.address_resolutions
    ADD CONSTRAINT address_resolutions_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: favorites favorites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_pkey PRIMARY KEY (user_id, site_id);


--
-- Name: neighborhoods neighborhoods_name_locality_city_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.neighborhoods
    ADD CONSTRAINT neighborhoods_name_locality_city_key UNIQUE (name, locality, city);


--
-- Name: neighborhoods neighborhoods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.neighborhoods
    ADD CONSTRAINT neighborhoods_pkey PRIMARY KEY (id);


--
-- Name: postal_municipalities postal_municipalities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.postal_municipalities
    ADD CONSTRAINT postal_municipalities_pkey PRIMARY KEY (divipola);


--
-- Name: reports reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_pkey PRIMARY KEY (id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: site_activities site_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_activities
    ADD CONSTRAINT site_activities_pkey PRIMARY KEY (site_id, activity_id);


--
-- Name: site_suggestions site_suggestions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_suggestions
    ADD CONSTRAINT site_suggestions_pkey PRIMARY KEY (id);


--
-- Name: sites sites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sites
    ADD CONSTRAINT sites_pkey PRIMARY KEY (id);


--
-- Name: sites sites_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sites
    ADD CONSTRAINT sites_slug_key UNIQUE (slug);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: idx_address_resolution_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_address_resolution_lookup ON public.address_resolutions USING btree (divipola, address_key);


--
-- Name: idx_address_resolution_standard_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_address_resolution_standard_trgm ON public.address_resolutions USING gin (standard_address public.gin_trgm_ops);


--
-- Name: idx_events_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_dates ON public.events USING btree (status, starts_on, ends_on);


--
-- Name: idx_postal_municipality_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_postal_municipality_lookup ON public.postal_municipalities USING btree (department_key, municipality_key);


--
-- Name: idx_reports_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reports_status ON public.reports USING btree (status, created_at DESC);


--
-- Name: idx_reviews_site_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_site_status ON public.reviews USING btree (site_id, status, created_at DESC);


--
-- Name: idx_site_suggestions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_site_suggestions_status ON public.site_suggestions USING btree (status, created_at DESC);


--
-- Name: idx_sites_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sites_category ON public.sites USING btree (category, status);


--
-- Name: idx_sites_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sites_location ON public.sites USING gist (location);


--
-- Name: idx_sites_status_score; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sites_status_score ON public.sites USING btree (status, trust_score DESC, rating_average DESC);


--
-- Name: events events_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: favorites favorites_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: favorites favorites_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: reports reports_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: reports reports_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: reviews reviews_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: site_activities site_activities_activity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_activities
    ADD CONSTRAINT site_activities_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES public.activities(id) ON DELETE CASCADE;


--
-- Name: site_activities site_activities_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_activities
    ADD CONSTRAINT site_activities_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: site_suggestions site_suggestions_approved_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_suggestions
    ADD CONSTRAINT site_suggestions_approved_site_id_fkey FOREIGN KEY (approved_site_id) REFERENCES public.sites(id) ON DELETE SET NULL;


--
-- Name: site_suggestions site_suggestions_duplicate_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_suggestions
    ADD CONSTRAINT site_suggestions_duplicate_site_id_fkey FOREIGN KEY (duplicate_site_id) REFERENCES public.sites(id) ON DELETE SET NULL;


--
-- Name: site_suggestions site_suggestions_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_suggestions
    ADD CONSTRAINT site_suggestions_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: site_suggestions site_suggestions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_suggestions
    ADD CONSTRAINT site_suggestions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: sites sites_neighborhood_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sites
    ADD CONSTRAINT sites_neighborhood_id_fkey FOREIGN KEY (neighborhood_id) REFERENCES public.neighborhoods(id);


--
-- PostgreSQL database dump complete
--

