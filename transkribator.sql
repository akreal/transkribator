--
-- PostgreSQL database dump
--

SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;

--
-- Name: plpgsql; Type: EXTENSION; Schema: -; Owner: 
--

CREATE EXTENSION IF NOT EXISTS plpgsql WITH SCHEMA pg_catalog;


--
-- Name: EXTENSION plpgsql; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION plpgsql IS 'PL/pgSQL procedural language';


SET search_path = public, pg_catalog;

SET default_tablespace = '';

SET default_with_oids = false;

--
-- Name: transcriptions; Type: TABLE; Schema: public; Owner: transkribator; Tablespace: 
--

CREATE TABLE transcriptions (
    utterance uuid NOT NULL,
    created timestamp without time zone DEFAULT now() NOT NULL,
    author integer DEFAULT 0 NOT NULL,
    transcription integer[] NOT NULL
);


ALTER TABLE public.transcriptions OWNER TO transkribator;

--
-- Name: users; Type: TABLE; Schema: public; Owner: transkribator; Tablespace: 
--

CREATE TABLE users (
    id integer NOT NULL,
    username text NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    properties json DEFAULT '{}'::json NOT NULL,
    settings json DEFAULT '{}'::json NOT NULL
);


ALTER TABLE public.users OWNER TO transkribator;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: transkribator
--

CREATE SEQUENCE users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.users_id_seq OWNER TO transkribator;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: transkribator
--

ALTER SEQUENCE users_id_seq OWNED BY users.id;


--
-- Name: utterancies; Type: TABLE; Schema: public; Owner: transkribator; Tablespace: 
--

CREATE TABLE utterancies (
    id uuid NOT NULL,
    owner integer NOT NULL,
    filename text NOT NULL,
    shared boolean DEFAULT false NOT NULL,
    title text,
    description text,
    created timestamp without time zone DEFAULT now() NOT NULL,
    updated timestamp without time zone DEFAULT now() NOT NULL,
    data bytea NOT NULL,
    properties json DEFAULT '{}'::json NOT NULL,
    cdata bytea
);


ALTER TABLE public.utterancies OWNER TO transkribator;

--
-- Name: id; Type: DEFAULT; Schema: public; Owner: transkribator
--

ALTER TABLE ONLY users ALTER COLUMN id SET DEFAULT nextval('users_id_seq'::regclass);


--
-- Name: transcriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: transkribator; Tablespace: 
--

ALTER TABLE ONLY transcriptions
    ADD CONSTRAINT transcriptions_pkey PRIMARY KEY (utterance, created);


--
-- Name: users_pkey; Type: CONSTRAINT; Schema: public; Owner: transkribator; Tablespace: 
--

ALTER TABLE ONLY users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: utterancies_pkey; Type: CONSTRAINT; Schema: public; Owner: transkribator; Tablespace: 
--

ALTER TABLE ONLY utterancies
    ADD CONSTRAINT utterancies_pkey PRIMARY KEY (id);


--
-- Name: users_lower_idx; Type: INDEX; Schema: public; Owner: transkribator; Tablespace: 
--

CREATE UNIQUE INDEX users_lower_idx ON users USING btree (lower(email));


--
-- Name: users_username_idx; Type: INDEX; Schema: public; Owner: transkribator; Tablespace: 
--

CREATE UNIQUE INDEX users_username_idx ON users USING btree (username);


--
-- Name: utterancies_created_idx; Type: INDEX; Schema: public; Owner: transkribator; Tablespace: 
--

CREATE INDEX utterancies_created_idx ON utterancies USING btree (created);


--
-- Name: utterancies_owner_idx; Type: INDEX; Schema: public; Owner: transkribator; Tablespace: 
--

CREATE INDEX utterancies_owner_idx ON utterancies USING btree (owner);


--
-- Name: utterancies_shared_idx; Type: INDEX; Schema: public; Owner: transkribator; Tablespace: 
--

CREATE INDEX utterancies_shared_idx ON utterancies USING btree (shared);


--
-- Name: utterancies_updated_idx; Type: INDEX; Schema: public; Owner: transkribator; Tablespace: 
--

CREATE INDEX utterancies_updated_idx ON utterancies USING btree (updated);


--
-- Name: public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM postgres;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO PUBLIC;


--
-- PostgreSQL database dump complete
--

