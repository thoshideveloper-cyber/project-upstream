"""Real companies for the firm's standing sourcing database — no Faker.

The sourcing pool is the firm's *company database*: the inventory an analyst searches
before a deal exists. Seeding it with invented names would make every screen that reads
it a lie, so every row here is a real, publicly-listed organisation whose name and
headquarters were taken from a public source (cited per block below) in August 2026.

**Only verified fields are recorded.** ``website`` is filled in only where the official
domain is unambiguous — it is the primary dedup key (``compute_domain_key``), so a
guessed domain is worse than no domain. Headcount and revenue are left to the client's
own workbooks, which carry researched figures; nothing here is estimated.

Two segments, because they are the two sides of the firm's real deal flow:
- ``TARGET`` — IT services, product engineering, managed services and security firms:
  the sell-side inventory (22by7, ProArch and Datalogixs are all of this shape).
- ``INVESTOR`` — private equity, growth and venture firms: the buy-side / capital-raise
  counterparties.

Sources:
- https://en.wikipedia.org/wiki/List_of_IT_consulting_firms
- https://en.wikipedia.org/wiki/List_of_private_equity_firms
- Vendor and press pages for the MSP entries (CRN MSP 500 2026 announcements)
- Company profile pages for Accion Labs, Tredence, Chiratae, Blume, Kalaari, Everstone
"""

from __future__ import annotations

TARGET = "TARGET"
INVESTOR = "INVESTOR"

# (company_name, hq, website_or_None, segment)
PoolRow = tuple[str, str, str | None, str]

# ── IT services / consulting — Wikipedia "List of IT consulting firms" ────────
_IT_SERVICES: list[PoolRow] = [
    ("Tata Consultancy Services", "Mumbai, India", "tcs.com", TARGET),
    ("Infosys", "Bengaluru, India", "infosys.com", TARGET),
    ("Wipro", "Bengaluru, India", "wipro.com", TARGET),
    ("HCLTech", "Noida, India", "hcltech.com", TARGET),
    ("Birlasoft", "Pune, India", "birlasoft.com", TARGET),
    ("Tech Mahindra", "Pune, India", "techmahindra.com", TARGET),
    ("Hinduja Global Solutions", "Bengaluru, India", "hgs.cx", TARGET),
    ("WNS Global Services", "Mumbai, India", "wns.com", TARGET),
    ("ITC Infotech", "Bengaluru, India", "itcinfotech.com", TARGET),
    ("NTT Data", "Tokyo, Japan", "nttdata.com", TARGET),
    ("Firstsource", "Mumbai, India", "firstsource.com", TARGET),
    ("Fujitsu", "Tokyo, Japan", "fujitsu.com", TARGET),
    ("LTIMindtree", "Mumbai, India", "ltimindtree.com", TARGET),
    ("Mphasis", "Bengaluru, India", "mphasis.com", TARGET),
    ("Pactera", "Dalian, China", None, TARGET),
    ("Neusoft Group", "Shenyang, China", "neusoft.com", TARGET),
    ("L&T Technology Services", "Vadodara, India", "ltts.com", TARGET),
    ("Persistent Systems", "Pune, India", "persistent.com", TARGET),
    ("Cyient", "Hyderabad, India", "cyient.com", TARGET),
    ("KPIT Technologies", "Pune, India", "kpit.com", TARGET),
    ("Coforge", "Noida, India", "coforge.com", TARGET),
    ("Zensar Technologies", "Pune, India", "zensar.com", TARGET),
    ("NCS Group", "Singapore", "ncs.co", TARGET),
    ("iSoftStone", "Beijing, China", None, TARGET),
    ("Accenture", "Dublin, Ireland", "accenture.com", TARGET),
    ("Akkodis", "Brussels, Belgium", "akkodis.com", TARGET),
    ("Alten", "Boulogne-Billancourt, France", "alten.com", TARGET),
    ("Asseco", "Rzeszów, Poland", "asseco.com", TARGET),
    ("Atos", "Bezons, France", "atos.net", TARGET),
    ("Capgemini", "Paris, France", "capgemini.com", TARGET),
    ("Globant", "Luxembourg City, Luxembourg", "globant.com", TARGET),
    ("Indra", "Madrid, Spain", "indracompany.com", TARGET),
    ("Luxoft", "Zug, Switzerland", "luxoft.com", TARGET),
    ("Sopra Steria", "Paris, France", "soprasteria.com", TARGET),
    ("TietoEVRY", "Espoo, Finland", "tietoevry.com", TARGET),
    ("T-Systems", "Frankfurt, Germany", "t-systems.com", TARGET),
    ("Avanade", "Seattle, Washington, United States", "avanade.com", TARGET),
    ("Booz Allen Hamilton", "McLean, Virginia, United States", "boozallen.com", TARGET),
    ("CGI Inc.", "Montreal, Canada", "cgi.com", TARGET),
    (
        "Cognizant Technology Solutions",
        "Teaneck, New Jersey, United States",
        "cognizant.com",
        TARGET,
    ),
    ("Concentrix", "Newark, California, United States", "concentrix.com", TARGET),
    ("Conduent", "Florham Park, New Jersey, United States", "conduent.com", TARGET),
    ("DXC Technology", "Tysons, Virginia, United States", "dxc.com", TARGET),
    ("EXL Service", "New York City, New York, United States", "exlservice.com", TARGET),
    ("Genpact", "New York City, New York, United States", "genpact.com", TARGET),
    ("Hewlett Packard Enterprise", "Spring, Texas, United States", "hpe.com", TARGET),
    ("Leidos", "San Diego, California, United States", "leidos.com", TARGET),
    ("Kyndryl", "New York, New York, United States", "kyndryl.com", TARGET),
    ("Softtek", "Monterrey, Mexico", "softtek.com", TARGET),
    (
        "Science Applications International Corporation",
        "Reston, Virginia, United States",
        "saic.com",
        TARGET,
    ),
    ("Telus International", "Vancouver, Canada", "telusinternational.com", TARGET),
    ("Unisys", "Blue Bell, Pennsylvania, United States", "unisys.com", TARGET),
    ("UST", "Aliso Viejo, California, United States", "ust.com", TARGET),
    ("Virtusa", "Southborough, Massachusetts, United States", "virtusa.com", TARGET),
    ("Slalom Consulting", "Seattle, Washington, United States", "slalom.com", TARGET),
    ("Algar Tech", "Uberlândia, Brazil", None, TARGET),
    ("Totvs", "São Paulo, Brazil", "totvs.com", TARGET),
    ("Stefanini IT Solutions", "Jaguariúna, Brazil", "stefanini.com", TARGET),
]

# ── Managed services / security providers — CRN MSP 500 2026 press coverage ──
_MSP: list[PoolRow] = [
    ("Accion Labs", "Pittsburgh, Pennsylvania, United States", "accionlabs.com", TARGET),
    ("Tredence", "San Jose, California, United States", "tredence.com", TARGET),
    ("NWN", "Boston, Massachusetts, United States", "nwn.ai", TARGET),
    ("NexusTek", "Denver, Colorado, United States", "nexustek.com", TARGET),
    ("Rackspace Technology", "San Antonio, Texas, United States", "rackspace.com", TARGET),
    ("Sirius Computer Solutions", "San Antonio, Texas, United States", None, TARGET),
    ("ABM", "Fargo, North Dakota, United States", "abmnow.com", TARGET),
    ("Powersolution.com", "New Jersey, United States", "powersolution.com", TARGET),
    ("Certified NETS", "United States", "certified-nets.com", TARGET),
    ("Corporate Technologies", "Minneapolis, Minnesota, United States", None, TARGET),
    ("CompassMSP", "United States", None, TARGET),
    ("Centre Technologies", "Houston, Texas, United States", None, TARGET),
    ("Integris", "United States", None, TARGET),
    ("Parachute Technology", "United States", None, TARGET),
    ("Infracore", "United States", None, TARGET),
    ("Realnets", "United States", None, TARGET),
    ("Vertical IT Solutions", "United States", None, TARGET),
    ("TrnDigital", "United States", None, TARGET),
    ("Bit by Bit Computer Consultants", "United States", None, TARGET),
    ("CyberDuo", "United States", None, TARGET),
]

# ── Private equity / growth — Wikipedia "List of private equity firms" ───────
_PE_GLOBAL: list[PoolRow] = [
    ("KKR", "New York City, United States", "kkr.com", INVESTOR),
    ("EQT AB", "Stockholm, Sweden", "eqtgroup.com", INVESTOR),
    ("Blackstone", "New York City, United States", "blackstone.com", INVESTOR),
    ("TPG", "San Francisco, United States", "tpg.com", INVESTOR),
    ("Thoma Bravo", "Chicago, United States", "thomabravo.com", INVESTOR),
    ("Hg", "London, United Kingdom", "hgcapital.com", INVESTOR),
    ("Bain Capital", "Boston, United States", "baincapital.com", INVESTOR),
    ("General Atlantic", "New York City, United States", "generalatlantic.com", INVESTOR),
    ("Advent International", "Boston, United States", "adventinternational.com", INVESTOR),
    ("Goldman Sachs Alternatives", "New York City, United States", None, INVESTOR),
    ("Clayton, Dubilier & Rice", "New York City, United States", "cdr-inc.com", INVESTOR),
    ("CVC Capital Partners", "Luxembourg, Luxembourg", "cvc.com", INVESTOR),
    ("Hellman & Friedman", "San Francisco, United States", "hf.com", INVESTOR),
    ("Warburg Pincus", "New York City, United States", "warburgpincus.com", INVESTOR),
    ("Clearlake Capital Group", "Santa Monica, United States", "clearlake.com", INVESTOR),
    ("Andreessen Horowitz", "Menlo Park, United States", "a16z.com", INVESTOR),
    ("Insight Partners", "New York City, United States", "insightpartners.com", INVESTOR),
    ("Leonard Green & Partners", "Los Angeles, United States", "leonardgreen.com", INVESTOR),
    ("HarbourVest Partners", "Boston, United States", "harbourvest.com", INVESTOR),
    ("Vista Equity Partners", "Austin, United States", "vistaequitypartners.com", INVESTOR),
    ("Veritas Capital", "New York, United States", "veritascapital.com", INVESTOR),
    ("The Carlyle Group", "Washington D.C., United States", "carlyle.com", INVESTOR),
    ("Apollo Global Management", "New York, United States", "apollo.com", INVESTOR),
    ("TA Associates", "Boston, United States", "ta.com", INVESTOR),
    ("Stone Point Capital", "Greenwich, United States", "stonepoint.com", INVESTOR),
    ("Blue Owl Capital", "New York, United States", "blueowl.com", INVESTOR),
    ("Silver Lake", "Menlo Park, United States", "silverlake.com", INVESTOR),
    ("Partners Group", "Baar, Switzerland", "partnersgroup.com", INVESTOR),
    ("Sequoia Capital", "Menlo Park, United States", "sequoiacap.com", INVESTOR),
    ("Ardian", "Paris, France", "ardian.com", INVESTOR),
    ("Ridgemont Equity Partners", "Charlotte, United States", "ridgemontep.com", INVESTOR),
    ("Equistone Partners Europe", "London, United Kingdom", "equistonepe.com", INVESTOR),
    ("Baring Private Equity Asia", "Hong Kong", None, INVESTOR),
    ("PAI Partners", "Paris, France", "paipartners.com", INVESTOR),
    ("Court Square Capital Partners", "New York, United States", "courtsquare.com", INVESTOR),
    ("MidOcean Partners", "New York, United States", "midoceanpartners.com", INVESTOR),
    ("Madison Dearborn Partners", "Chicago, United States", "mdcp.com", INVESTOR),
    ("GTCR", "Chicago, United States", "gtcr.com", INVESTOR),
    ("HPS Investment Partners", "New York, United States", "hpspartners.com", INVESTOR),
    ("One Equity Partners", "Chicago, United States", "oneequity.com", INVESTOR),
    ("Trilantic Capital Partners", "New York, United States", "trilantic.com", INVESTOR),
    ("Bridgepoint Capital", "London, United Kingdom", "bridgepoint.eu", INVESTOR),
    ("Pamlico Capital", "Charlotte, United States", "pamlicocapital.com", INVESTOR),
    ("Lightyear Capital", "New York, United States", "lycap.com", INVESTOR),
    ("Affinity Equity Partners", "Hong Kong", "affinityequity.com", INVESTOR),
    ("Capvis", "Zurich, Switzerland", "capvis.com", INVESTOR),
    ("Francisco Partners", "San Francisco, United States", "franciscopartners.com", INVESTOR),
    ("H.I.G. Capital", "Miami, United States", "higcapital.com", INVESTOR),
    ("Genstar Capital", "San Francisco, United States", "gencap.com", INVESTOR),
    ("New Mountain Capital", "New York, United States", "newmountaincapital.com", INVESTOR),
    ("Providence Equity Partners", "Providence, United States", "provequity.com", INVESTOR),
    ("Summit Partners", "Boston, United States", "summitpartners.com", INVESTOR),
    ("Sycamore Partners", "New York, United States", "sycamorepartners.com", INVESTOR),
    ("Symphony Technology Group", "Menlo Park, United States", "stgpartners.com", INVESTOR),
    ("Thomas H. Lee Partners", "Boston, United States", "thl.com", INVESTOR),
    ("TowerBrook Capital Partners", "New York, United States", "towerbrook.com", INVESTOR),
    ("Platinum Equity", "Beverly Hills, United States", "platinumequity.com", INVESTOR),
    ("Berkshire Partners", "Boston, United States", "berkshirepartners.com", INVESTOR),
    ("Charlesbank Capital Partners", "Boston, United States", "charlesbank.com", INVESTOR),
    ("Frontenac Company", "Chicago, United States", "frontenac.com", INVESTOR),
]

# ── Asia-Pacific PE — same Wikipedia list ────────────────────────────────────
_PE_ASIA: list[PoolRow] = [
    ("Boyu Capital", "Hong Kong", None, INVESTOR),
    ("CITIC Capital", "Hong Kong, China", "citiccapital.com", INVESTOR),
    ("FountainVest Partners", "Hong Kong", "fountainvest.com", INVESTOR),
    ("Hillhouse Capital Group", "Singapore", "hillhousecapital.com", INVESTOR),
    ("Hony Capital", "Beijing, China", None, INVESTOR),
    ("MBK Partners", "Seoul, South Korea", "mbkpartnerslp.com", INVESTOR),
    ("PAG", "Hong Kong", "pagasia.com", INVESTOR),
    ("Primavera Capital Group", "Hong Kong", None, INVESTOR),
    ("Quadria Capital", "Singapore", "quadriacapital.com", INVESTOR),
    ("Northstar Group", "Singapore", None, INVESTOR),
    ("Axiom Asia", "Singapore", None, INVESTOR),
    ("Dymon Asia Private Equity", "Singapore", None, INVESTOR),
    ("Pacific Equity Partners", "Sydney, Australia", "pep.com.au", INVESTOR),
    ("BGH Capital", "Melbourne, Australia", None, INVESTOR),
    ("Archer Capital", "Sydney, Australia", None, INVESTOR),
    ("Mekong Capital", "Ho Chi Minh City, Vietnam", "mekongcapital.com", INVESTOR),
    ("JAFCO", "Tokyo, Japan", None, INVESTOR),
]

# ── India PE / VC — verified individually (the client's home market) ─────────
_PE_INDIA: list[PoolRow] = [
    ("ChrysCapital", "New Delhi, India", "chryscapital.com", INVESTOR),
    ("True North", "Mumbai, India", "truenorth.co.in", INVESTOR),
    ("Kedaara Capital", "Mumbai, India", "kedaara.com", INVESTOR),
    ("Multiples Alternate Asset Management", "Mumbai, India", "multiplesequity.com", INVESTOR),
    ("Everstone Capital", "Mumbai, India", "everstonecapital.com", INVESTOR),
    ("Blume Ventures", "Mumbai, India", "blume.vc", INVESTOR),
    ("Chiratae Ventures", "Bengaluru, India", "chiratae.com", INVESTOR),
    ("Kalaari Capital", "Bengaluru, India", "kalaari.com", INVESTOR),
    ("Nexus Venture Partners", "Mumbai, India", "nexusvp.com", INVESTOR),
]

DATASET: list[PoolRow] = [*_IT_SERVICES, *_MSP, *_PE_GLOBAL, *_PE_ASIA, *_PE_INDIA]


def rows() -> list[dict]:
    """The dataset as profile-fact dicts, ready for ``upsert_profile``."""
    return [
        {
            "company_name": name,
            "hq": hq,
            "website": f"https://{domain}" if domain else None,
            "linkedin": None,
            "headcount": None,
            "revenue_source": None,
            "revenue_inr_cr": None,
            "_segment": segment,
        }
        for name, hq, domain, segment in DATASET
    ]
