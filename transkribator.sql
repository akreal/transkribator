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


--
-- Name: lo; Type: EXTENSION; Schema: -; Owner: 
--

CREATE EXTENSION IF NOT EXISTS lo WITH SCHEMA public;


--
-- Name: EXTENSION lo; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION lo IS 'Large Object maintenance';


SET search_path = public, pg_catalog;

SET default_tablespace = '';

SET default_with_oids = false;

--
-- Name: files; Type: TABLE; Schema: public; Owner: transkribator; Tablespace: 
--

CREATE TABLE files (
    id integer NOT NULL,
    created timestamp without time zone DEFAULT now() NOT NULL,
    updated timestamp without time zone DEFAULT now() NOT NULL,
    properties json DEFAULT '{}'::json NOT NULL,
    data lo NOT NULL
);


ALTER TABLE files OWNER TO transkribator;

--
-- Name: files_id_seq; Type: SEQUENCE; Schema: public; Owner: transkribator
--

CREATE SEQUENCE files_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE files_id_seq OWNER TO transkribator;

--
-- Name: files_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: transkribator
--

ALTER SEQUENCE files_id_seq OWNED BY files.id;


--
-- Name: transcriptions; Type: TABLE; Schema: public; Owner: transkribator; Tablespace: 
--

CREATE TABLE transcriptions (
    utterance uuid NOT NULL,
    created timestamp without time zone DEFAULT now() NOT NULL,
    author integer DEFAULT 0 NOT NULL,
    transcription integer[] NOT NULL
);


ALTER TABLE transcriptions OWNER TO transkribator;

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


ALTER TABLE users OWNER TO transkribator;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: transkribator
--

CREATE SEQUENCE users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE users_id_seq OWNER TO transkribator;

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
    properties json DEFAULT '{}'::json NOT NULL,
    datafile integer,
    cdatafile integer
);


ALTER TABLE utterancies OWNER TO transkribator;

--
-- Name: id; Type: DEFAULT; Schema: public; Owner: transkribator
--

ALTER TABLE ONLY files ALTER COLUMN id SET DEFAULT nextval('files_id_seq'::regclass);


--
-- Name: id; Type: DEFAULT; Schema: public; Owner: transkribator
--

ALTER TABLE ONLY users ALTER COLUMN id SET DEFAULT nextval('users_id_seq'::regclass);


--
-- Name: files_pkey; Type: CONSTRAINT; Schema: public; Owner: transkribator; Tablespace: 
--

ALTER TABLE ONLY files
    ADD CONSTRAINT files_pkey PRIMARY KEY (id);


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
-- Name: files_created_idx; Type: INDEX; Schema: public; Owner: transkribator; Tablespace: 
--

CREATE INDEX files_created_idx ON files USING btree (created);


--
-- Name: files_updated_idx; Type: INDEX; Schema: public; Owner: transkribator; Tablespace: 
--

CREATE INDEX files_updated_idx ON files USING btree (updated);


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
-- Name: t_data; Type: TRIGGER; Schema: public; Owner: transkribator
--

CREATE TRIGGER t_data BEFORE DELETE OR UPDATE ON files FOR EACH ROW EXECUTE PROCEDURE lo_manage('data');


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

