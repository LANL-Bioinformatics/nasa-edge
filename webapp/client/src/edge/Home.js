import { Col, Row } from 'reactstrap'
import { colors } from 'src/util'
import AppBanner from 'src/edge/common/AppBanner'

const Home = () => {
  return (
    <>
      <AppBanner />
      <div className="animated fadeIn">
        <Row className="justify-content-center">
          <Col xs="12" sm="12" md="12">
            <div className="clearfix edge-home">
              <br></br>
              <h2>
                <span style={{ color: colors.app }}>
                  <u>E</u>
                </span>
                mpowering the &nbsp;
                <span style={{ color: colors.app }}>
                  <u>D</u>
                </span>
                evelopment of &nbsp;
                <span style={{ color: colors.app }}>
                  <u>G</u>
                </span>
                enomics &nbsp;
                <span style={{ color: colors.app }}>
                  <u>E</u>
                </span>
                xpertise
              </h2>
              <hr></hr>
              EDGE bioinformatics is intended to help truly democratize the use of Next Generation
              Sequencing for exploring genomes and metagenomes. Given that bioinformatic analysis is
              now the rate limiting factor in genomics, we developed EDGE bioinformatics with a
              user-friendly interface that allows scientists to perform a number of tailored
              analyses using many cutting-edge tools.
              <br></br>
              <br></br>
              <br></br>
              <h2>Features of EDGE</h2>
              <hr></hr>
              <ul>
                <li>No need for high-level bioinformaticists</li>
                <li>
                  Allow users to address a wide range of use cases including the assembly/annotation
                  and comparison of novel genomes, and the characterization of complex clinical or
                  environmental samples
                </li>
                <li>
                  Can present the results of several taxonomy classification tools for easy
                  comparison
                </li>
                <li>Focus on accurate and rapid analysis</li>
                <li>
                  Enables sequencing as a solution in facilities where human-resources, space,
                  bandwidth, and time are limited
                </li>
              </ul>
              <br></br>
              <h2>Implementation</h2>
              <hr></hr>
              <ul>
                <li>
                  EDGE Bioinformatics is built around a collection of publicly available,
                  open-source software packaged or in-house developed tools/algorithms/scripts to
                  process <b>FASTQ data</b> or <b>Contig FASTA data</b> (there is currently limited
                  capability of incorporating PacBio and Oxford Nanopore data into the Assembly
                  module)
                </li>
                <li>
                  The EDGE bioinformatics web-based graphic user interface is primarily implemented
                  using the MERN (MongoDB, ExpressJS, ReactJS, NodeJS) stack
                </li>
                <li>
                  The current version of EDGE pipeline has been extensively tested on Linux
                  platforms with Ubuntu 18.04 and CentOS 7 operation system and will only work on
                  64bit Linux environments
                </li>
                <li>
                  Due to the involvement of several memory/time consuming steps, we normally
                  recommend computers with at least 24GB memory and 8 CPUs, though we typically use
                  on servers with a minimum of 256GB memory with 64 CPUs
                </li>
              </ul>
              <br></br>
              <h2>Publication</h2>
              <hr></hr>
              Po-E Li, Chien-Chi Lo, Joseph J. Anderson, Karen W. Davenport, Kimberly A.
              Bishop-Lilly, Yan Xu, Sanaa Ahmed, Shihai Feng, Vishwesh P. Mokashi, Patrick S. G.
              Chain (2016),{' '}
              <b>
                Enabling the democratization of the genomics revolution with a fully integrated
                web-based bioinformatics platform
              </b>
              , <em>Nucleic Acids Research</em>
              (doi:{' '}
              <a
                href="http://nar.oxfordjournals.org/content/early/2016/11/28/nar.gkw1027.full"
                target="_blank"
                rel="noreferrer"
              >
                10.1093/nar/gkw1027
              </a>
              )
            </div>
            <br></br>
            <br></br>
          </Col>
        </Row>
      </div>
    </>
  )
}

export default Home
